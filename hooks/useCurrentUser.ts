'use client';

/**
 * The current identity, read from the session provider instead of fetched.
 *
 * This hook used to call `/api/auth/me` on every mount, and it is mounted by
 * the tab bar, the nav bar, the account sheet and the screen itself — four
 * requests for one answer, each paying a round trip inside the WebView. The
 * provider in `components/auth-context.tsx` already holds that answer for the
 * session and refetches it when the token changes, so this hook is now a read.
 */

import { useCurrentUser as useSessionUser } from '@/components/auth-context';

export interface CurrentUser {
  userId: string;
  name: string;
  email: string;
  role: string;
  tenantId?: string;
  platformRole?: string;
  impersonatedBy?: string;
}

export const useCurrentUser = () => {
  const { user, isLoading } = useSessionUser();

  return {
    user: (user as CurrentUser | null) ?? null,
    isLoading,
    // Kept for the callers that branch on it; an identity that could not be
    // read is `null`, which is the state they already handle.
    error: null as string | null,
  };
};
