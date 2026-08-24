/**
 * Access control configuration for WeParts Commercial.
 *
 * WHAT TO CONFIGURE HERE
 * ----------------------
 * This file is the single place where "who is who" is declared. It holds no
 * logic — resolution lives in services/userProfile.ts.
 *
 * Security Roles are NOT available: the generated systemusers model exposes no
 * role columns. Reading them would require connecting the role tables through
 * `pac code add-data`. Until then, resolution uses Business Unit, the sign-in
 * domain and an explicit admin list.
 */

export type UserProfile = 'customer' | 'sales' | 'admin';

/** Least privilege. Every unresolved or failed lookup lands here. */
export const DEFAULT_PROFILE: UserProfile = 'customer';

/**
 * Sign-in domains treated as Weatherford-internal.
 *
 * ASSUMPTION TO CONFIRM: seeded with weatherford.com, the domain seen on the
 * supplier contacts of the Foresea purchase orders. An internal user signing in
 * under any other domain is downgraded to 'customer' — safe, but wrong. Add the
 * missing domains here rather than loosening the rule elsewhere.
 */
export const INTERNAL_EMAIL_DOMAINS: readonly string[] = ['weatherford.com'];

/**
 * Business Unit name -> profile. Takes precedence over the domain rule.
 * Empty by design: the real Business Unit names are not known to this codebase.
 * Fill in as they are confirmed, e.g. { 'WeParts Commercial': 'sales' }.
 */
export const BUSINESS_UNIT_PROFILES: Readonly<Record<string, UserProfile>> = {};

/**
 * Sign-in names (UPN) granted 'admin'. Compared case-insensitively.
 * Empty means nobody is admin. Admin currently sees the same screens as sales;
 * it exists so configuration surfaces can be gated to it later.
 */
export const ADMIN_PRINCIPALS: readonly string[] = [];

/** True for internal profiles. External customers must never reach internal surfaces. */
export function isInternal(profile: UserProfile): boolean {
  return profile === 'sales' || profile === 'admin';
}
