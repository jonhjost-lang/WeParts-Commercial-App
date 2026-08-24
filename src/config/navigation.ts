/**
 * Navigation map for WeParts Commercial.
 *
 * Single source of truth for the app's destinations. The Sidebar, the Header
 * command palette and the screen mounting in App all read from here, so a
 * destination can only be gated in one place.
 */

import type { UserProfile } from './accessControl';

export type ScreenName = 'home' | 'catalog' | 'orders' | 'fulfillment';

export interface Destination {
  id: ScreenName;
  label: string;
  hint: string;
  /** Profiles allowed to reach this screen. */
  profiles: readonly UserProfile[];
}

const ALL_PROFILES = ['customer', 'sales', 'admin'] as const;
const INTERNAL_ONLY = ['sales', 'admin'] as const;

export const DESTINATIONS: readonly Destination[] = [
  { id: 'home', label: 'Home', hint: 'Global sales portal', profiles: ALL_PROFILES },
  { id: 'catalog', label: 'Purchase Catalog', hint: 'Browse MPD products and pricing', profiles: ALL_PROFILES },
  { id: 'orders', label: 'My Orders', hint: 'Track purchase requests and history', profiles: ALL_PROFILES },
  // Internal operation: treating requests and registering deliveries.
  { id: 'fulfillment', label: 'Order Fulfillment', hint: 'Treat requests and register deliveries', profiles: INTERNAL_ONLY },
];

export const HOME_SCREEN: ScreenName = 'home';

export function destinationsFor(profile: UserProfile): Destination[] {
  return DESTINATIONS.filter((destination) => destination.profiles.includes(profile));
}

export function canAccess(screen: ScreenName, profile: UserProfile): boolean {
  const destination = DESTINATIONS.find((item) => item.id === screen);
  return destination ? destination.profiles.includes(profile) : false;
}

export function isScreenName(value: string): value is ScreenName {
  return DESTINATIONS.some((destination) => destination.id === value);
}
