'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { clearMobileToken, getMobileToken } from '@/lib/mobile-auth';

interface AuthUser {
  userId: string;
  name?: string;
  email?: string;
  role: string;
  tenantId?: string;
  platformRole?: string;
  impersonatedBy?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, isLoading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  /**
   * The token the last answer was fetched with.
   *
   * This provider used to re-run on every pathname change, which cost one
   * round trip per navigation (a fifth of a second on a phone) for an answer
   * that cannot change: the JWT carries the user's role and tenant, and the
   * only thing that rewrites it is selecting another workspace. Comparing the
   * token keeps that case working — the new token differs, so the identity is
   * refetched — while a plain navigation is now free.
   */
  const tokenRef = useRef<string | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const loadUser = useCallback(async () => {
    const token = await getMobileToken().catch(() => null);

    // Same session as the answer already held: in the app the token is the
    // whole identity, so there is nothing to ask about.
    if (token !== null && token === tokenRef.current) return;
    if (inFlight.current) return inFlight.current;

    const run = (async () => {
      try {
        const res = await apiFetch('/api/me');
        // A 401 means the token was rejected outright — expired, or signed with
        // a rotated secret. Drop it so the device isn't holding a dead token.
        // (An offline call rejects instead, so this can't fire on a blip.)
        if (res.status === 401) {
          await clearMobileToken();
          tokenRef.current = null;
          setUser(null);
          return;
        }
        const data = res.ok ? await res.json() : null;
        tokenRef.current = token;
        setUser(data);
      } catch {
        // Offline: keep whatever identity is already held rather than blanking
        // the shell, and let the next focus event try again.
      } finally {
        setIsLoading(false);
        inFlight.current = null;
      }
    })();

    inFlight.current = run;
    return run;
  }, []);

  useEffect(() => {
    void loadUser();
  }, [pathname, loadUser]);

  // Coming back to the app is the moment a session may have been revoked (or a
  // workspace switched elsewhere). One check on focus keeps that covered
  // without paying for it on every tap.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') void loadUser();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadUser]);

  return <AuthContext.Provider value={{ user, isLoading }}>{children}</AuthContext.Provider>;
}

export function useCurrentUser(): AuthContextValue {
  return useContext(AuthContext);
}
