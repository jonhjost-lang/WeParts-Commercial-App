/**
 * Navigation map for WeParts Commercial.
 *
 * Single source of truth for the app's destinations and for the areas that
 * group them. The Sidebar, the Header command palette, the breadcrumb and the
 * screen mounting in App all read from here, so a destination can only be gated
 * in one place.
 */

import type { UserProfile } from './accessControl';

export type ScreenName = 'home' | 'catalog' | 'orders' | 'fulfillment' | 'po-templates';

export type AreaName = 'Workspace' | 'Operations' | 'Administration';

export interface Destination {
  id: ScreenName;
  area: AreaName;
  label: string;
  hint: string;
  /** Profiles allowed to reach this screen. */
  profiles: readonly UserProfile[];
}

const ALL_PROFILES = ['customer', 'sales', 'admin'] as const;
const INTERNAL_ONLY = ['sales', 'admin'] as const;
const ADMIN_ONLY = ['admin'] as const;

/** Areas render in this order; an area with no visible destination is hidden. */
export const AREA_ORDER: readonly AreaName[] = ['Workspace', 'Operations', 'Administration'];

export const DESTINATIONS: readonly Destination[] = [
  { id: 'home', area: 'Workspace', label: 'Home', hint: 'Global sales portal', profiles: ALL_PROFILES },
  { id: 'catalog', area: 'Workspace', label: 'Purchase Catalog', hint: 'Browse MPD products and pricing', profiles: ALL_PROFILES },

  /**
   * Approved design splits this into two screens: My Orders scoped to the
   * customer's own company, and a separate Customer Orders screen for the sales
   * portfolio. The second one needs the customer and contract tables, so the
   * split lands with them — until then this stays reachable by every profile
   * rather than cutting internal users off from a replacement that does not
   * exist yet.
   */
  { id: 'orders', area: 'Workspace', label: 'My Orders', hint: 'Track purchase requests and history', profiles: ALL_PROFILES },

  // Internal operation: treating requests and registering deliveries.
  { id: 'fulfillment', area: 'Operations', label: 'Order Fulfillment', hint: 'Treat requests and register deliveries', profiles: INTERNAL_ONLY },

  { id: 'po-templates', area: 'Administration', label: 'PO Templates', hint: 'Purchase order layouts the parser recognizes', profiles: ADMIN_ONLY },

  /**
   * Also approved, still waiting on data:
   *   PO Inbox (Operations, internal) — needs wep_poimportlog
   *   Access   (Administration, admin) — needs the profile configuration table
   * Not declared here on purpose: a menu item that leads nowhere is worse than
   * a missing one.
   */
];

export const HOME_SCREEN: ScreenName = 'home';

export function destinationsFor(profile: UserProfile): Destination[] {
  return DESTINATIONS.filter((destination) => destination.profiles.includes(profile));
}

/** Areas that have at least one destination this profile can reach, in order. */
export function areasFor(profile: UserProfile): { area: AreaName; destinations: Destination[] }[] {
  const visible = destinationsFor(profile);
  return AREA_ORDER
    .map((area) => ({ area, destinations: visible.filter((destination) => destination.area === area) }))
    .filter((group) => group.destinations.length > 0);
}

export function destinationFor(screen: ScreenName): Destination | undefined {
  return DESTINATIONS.find((destination) => destination.id === screen);
}

export function canAccess(screen: ScreenName, profile: UserProfile): boolean {
  const destination = destinationFor(screen);
  return destination ? destination.profiles.includes(profile) : false;
}

export function isScreenName(value: string): value is ScreenName {
  return DESTINATIONS.some((destination) => destination.id === value);
}
