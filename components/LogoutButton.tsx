"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { clearMobileToken } from "@/lib/mobile-auth";

export function LogoutButton() {
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


