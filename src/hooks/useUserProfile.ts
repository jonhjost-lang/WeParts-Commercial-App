import { useEffect, useState } from 'react';

import { DEFAULT_PROFILE } from '../config/accessControl';
import { getUserProfile, type ResolvedProfile } from '../services/userProfile';

/**
 * Starts at least privilege on purpose: while resolution is in flight the app
 * renders as if the user were external, so an internal destination never
 * flashes before being gated.
 */
const PENDING: ResolvedProfile = {
  profile: DEFAULT_PROFILE, source: 'fallback', businessUnit: null,
  principalName: null, systemUserId: null, isFallback: true,
};

export function useUserProfile() {
  const [resolved, setResolved] = useState<ResolvedProfile>(PENDING);
  const [isResolving, setIsResolving] = useState(true);

  useEffect(() => {
    let active = true;
    void getUserProfile()
      .then((value) => { if (active) setResolved(value); })
      .finally(() => { if (active) setIsResolving(false); });
    return () => { active = false; };
  }, []);

  return { ...resolved, isResolving };
}
