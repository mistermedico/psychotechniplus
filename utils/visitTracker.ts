import { useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import { useAdminStore } from '../store/adminStore';

// Stable random session ID for the lifetime of this app launch
let SESSION_ID = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export function getSessionId(): string {
  return SESSION_ID;
}

/**
 * Call at the top of any screen component to log a page visit.
 * Works for both authenticated users and unauthenticated guests.
 */
export function useScreenVisit(screenName: string, meta?: string): void {
  const userId = useUserStore(s => s.userId);
  const name = useUserStore(s => s.name);
  const email = useUserStore(s => s.email);
  const isAuthenticated = useUserStore(s => s.isAuthenticated);
  const logVisit = useAdminStore(s => s.logVisit);

  useEffect(() => {
    logVisit({
      screen: screenName,
      action: 'ביקור',
      userId: isAuthenticated && userId ? userId : null,
      userName: isAuthenticated && name ? name : 'אורח',
      userEmail: isAuthenticated ? email : '',
      isGuest: !isAuthenticated,
      sessionId: SESSION_ID,
      meta,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Log a specific action (not just a page visit).
 * Call this imperatively when an action occurs (e.g. purchase, session complete).
 */
export function logUserAction(params: {
  screen: string;
  action: string;
  userId: string | null;
  userName: string;
  userEmail: string;
  isGuest: boolean;
  meta?: string;
}): void {
  useAdminStore.getState().logVisit({
    ...params,
    sessionId: SESSION_ID,
  });
}
