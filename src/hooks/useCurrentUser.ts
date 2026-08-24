import { useEffect, useState } from 'react';

import { getCurrentUser, type CurrentUser } from '../services/currentUser';

const FALLBACK_USER: CurrentUser = {
  fullName: 'Signed-in user',
  initials: 'US',
  subtitle: 'Power Apps user',
  photoUrl: null,
};

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser>(FALLBACK_USER);

  useEffect(() => {
    let active = true;
    void getCurrentUser()
      .then((loadedUser) => {
        if (active) setUser(loadedUser);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return user;
}
