"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const ADMIN_ROLES = ["admin", "manager"];

/**
 * Client-side stand-in for the server `getAuthUser()` + `isAdmin()` gate used by
 * the web admin pages. Static exports have no middleware and no request cookie
 * at render time, so mobile admin routes gate after hydration instead.
 *
 * This is a UX guard, not a security boundary — the API routes still enforce
 * the real check server-side.
 */
export function MobileAdminGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading, error } = useCurrentUser();
  const router = useRouter();

  const isAuthorised = Boolean(user && ADMIN_ROLES.includes(user.role));

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!isAuthorised) {
      router.replace("/app");
    }
  }, [isLoading, user, isAuthorised, router]);

  if (isLoading || error || !isAuthorised) {
    return (
      <div className="container mx-auto max-w-2xl space-y-4 px-4 py-6 sm:py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return <>{children}</>;
}
