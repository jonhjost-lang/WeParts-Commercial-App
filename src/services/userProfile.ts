import { getContext } from '@microsoft/power-apps/app';

import type { Systemusers } from '../generated/models/SystemusersModel';
import { SystemusersService } from '../generated/services/SystemusersService';
import {
  ADMIN_PRINCIPALS, BUSINESS_UNIT_PROFILES, DEFAULT_PROFILE,
  INTERNAL_EMAIL_DOMAINS, type UserProfile,
} from '../config/accessControl';

export type ProfileSource = 'admin-list' | 'business-unit' | 'email-domain' | 'fallback';

export interface ResolvedProfile {
  profile: UserProfile;
  /** Which rule decided the profile. 'fallback' means resolution failed. */
  source: ProfileSource;
  businessUnit: string | null;
  principalName: string | null;
  systemUserId: string | null;
  /**
   * True when the profile could not be resolved and least privilege was applied.
   * Screens must treat this as "restricted", never as "not loaded yet".
   */
  isFallback: boolean;
}

const FALLBACK: ResolvedProfile = {
  profile: DEFAULT_PROFILE, source: 'fallback', businessUnit: null,
  principalName: null, systemUserId: null, isFallback: true,
};

function domainOf(value: string | null | undefined): string | null {
  const at = value?.lastIndexOf('@') ?? -1;
  return at >= 0 ? value!.slice(at + 1).toLowerCase().trim() || null : null;
}

const escapeOData = (value: string) => value.replace(/'/g, "''");

/**
 * Matches the signed-in user against the systemusers table.
 *
 * The Entra object id is preferred over the sign-in name: it does not change
 * when a user is renamed. domainname is the fallback join key.
 */
async function findSystemUser(principalName: string | null, objectId: string | null) {
  const clauses = [
    objectId ? `azureactivedirectoryobjectid eq '${escapeOData(objectId)}'` : null,
    principalName ? `domainname eq '${escapeOData(principalName)}'` : null,
    principalName ? `internalemailaddress eq '${escapeOData(principalName)}'` : null,
  ].filter(Boolean) as string[];

  if (!clauses.length) return null;

  const result = await SystemusersService.getAll({
    select: ['systemuserid', 'domainname', 'internalemailaddress', 'businessunitidname', 'isdisabled'],
    filter: clauses.join(' or '),
    top: 2,
  });

  if (!result.success) throw new Error(result.error?.message || 'Dataverse did not return the signed-in user.');

  const rows = (result.data || []) as Systemusers[];
  // More than one match means the join keys are ambiguous — refuse to guess.
  return rows.length === 1 ? rows[0] : null;
}

function decide(businessUnit: string | null, principalName: string | null): { profile: UserProfile; source: ProfileSource } {
  const principal = principalName?.toLowerCase().trim() || null;

  if (principal && ADMIN_PRINCIPALS.some((entry) => entry.toLowerCase().trim() === principal)) {
    return { profile: 'admin', source: 'admin-list' };
  }

  const mapped = businessUnit ? BUSINESS_UNIT_PROFILES[businessUnit.trim()] : undefined;
  if (mapped) return { profile: mapped, source: 'business-unit' };

  const domain = domainOf(principal);
  if (domain && INTERNAL_EMAIL_DOMAINS.some((entry) => entry.toLowerCase() === domain)) {
    return { profile: 'sales', source: 'email-domain' };
  }

  return { profile: DEFAULT_PROFILE, source: 'fallback' };
}

/**
 * Resolves the profile of the signed-in user.
 *
 * Never throws and never fails open: any error, any ambiguous match and any
 * disabled account resolve to the least-privileged profile.
 *
 * This is the second layer of access control, not the only one. Row-level
 * security in Dataverse remains responsible for what data a user can read.
 */
export async function getUserProfile(): Promise<ResolvedProfile> {
  try {
    const context = await getContext();
    const principalName = context.user.userPrincipalName?.trim() || null;
    const objectId = context.user.objectId?.trim() || null;

    const record = await findSystemUser(principalName, objectId);
    if (record?.isdisabled) return FALLBACK;

    const businessUnit = record?.businessunitidname?.trim() || null;
    const signInName = record?.domainname?.trim() || record?.internalemailaddress?.trim() || principalName;

    const { profile, source } = decide(businessUnit, signInName);

    return {
      profile, source, businessUnit,
      principalName: signInName,
      systemUserId: record?.systemuserid ?? null,
      isFallback: source === 'fallback',
    };
  } catch {
    return FALLBACK;
  }
}
