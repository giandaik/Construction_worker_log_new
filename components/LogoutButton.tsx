"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { clearMobileToken } from "@/lib/mobile-auth";

export function LogoutButton({ row = false }: { row?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await apiFetch("/api/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      // Always drop the stored token, even if the request failed: the server
      // clearing the cookie is not what ends a mobile session, the device
      // forgetting the token is. No-op on web.
      await clearMobileToken();
      setLoading(false);
      router.push("/login");
    }
  }

  if (row) {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        className="ios-tap flex w-full items-center justify-center gap-2 rounded-xl border text-[17px] font-semibold text-red-600"
        style={{ borderColor: "var(--ios-sep)" }}
      >
        <LogOut className="h-5 w-5" />
        {loading ? "Signing out…" : "Sign out"}
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="top-4 right-4 z-50"
      onClick={handleLogout}
      disabled={loading}
      title="Logout"
    >
      <LogOut className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100" />
    </Button>
  );
}


