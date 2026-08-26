'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { clearMobileToken } from '@/lib/mobile-auth';

interface AuthUser {
  userId: string;
  role: string;
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

  useEffect(() => {
    apiFetch('/api/me')
      .then(async (res) => {
        // A 401 means the token was rejected outright — expired, or signed with
        // a rotated secret. Drop it so the device isn't holding a dead token.
        // (An offline call rejects instead, so this can't fire on a blip.)
        if (res.status === 401) await clearMobileToken();
        return res.ok ? res.json() : null;
      })
      .then((data) => {
        setUser(data);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [pathname]);

  return <AuthContext.Provider value={{ user, isLoading }}>{children}</AuthContext.Provider>;
}

export function useCurrentUser(): AuthContextValue {
  return useContext(AuthContext);
}
