import { getContext } from '@microsoft/power-apps/app';

import { Office365UsersService } from '../generated/services/Office365UsersService';

export interface CurrentUser {
  fullName: string;
  initials: string;
  subtitle: string;
  photoUrl: string | null;
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0]}` : parts[0]?.slice(0, 2) || 'US').toUpperCase();
}

function imageDataUrl(data: string) {
  return data.startsWith('data:') ? data : `data:image/jpeg;base64,${data}`;
}

function toProperCase(value: string) {
  return value.toLocaleLowerCase().replace(/(^|[\s/(&-])\p{L}/gu, (letter) => letter.toLocaleUpperCase());
}

export async function getUserPhoto(email: string): Promise<string | null> {
  const photo = await Office365UsersService.UserPhoto_V2(email);
  return photo.success && photo.data ? imageDataUrl(photo.data) : null;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const context = await getContext();
  const contextName = context.user.fullName?.trim() || context.user.userPrincipalName?.split('@')[0] || 'Signed-in user';
  let fullName = contextName;
  let subtitle = context.user.userPrincipalName || 'Power Apps user';
  let photoUrl: string | null = null;
  const photoIdentity = context.user.userPrincipalName || context.user.objectId;

  const [profileResult, photoResult] = await Promise.all([
    Office365UsersService.MyProfile_V2('id,displayName,jobTitle,mail,userPrincipalName'),
    photoIdentity ? Office365UsersService.UserPhoto_V2(photoIdentity) : Promise.resolve(null),
  ]);

  const profile = profileResult.success ? profileResult.data : undefined;
  if (profile) {
    fullName = profile.displayName?.trim() || fullName;
    subtitle = profile.jobTitle?.trim() ? toProperCase(profile.jobTitle.trim()) : profile.mail || profile.userPrincipalName || subtitle;
  }

  if (photoResult?.success && photoResult.data) {
    photoUrl = imageDataUrl(photoResult.data);
  } else if (profile?.id && profile.id !== photoIdentity) {
    const retry = await Office365UsersService.UserPhoto_V2(profile.id);
    if (retry.success && retry.data) photoUrl = imageDataUrl(retry.data);
  }

  return { fullName, initials: initialsFor(fullName), subtitle, photoUrl };
}
