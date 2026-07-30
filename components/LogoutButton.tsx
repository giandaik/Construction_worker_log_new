"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await apiFetch("/api/logout", { method: "POST" });
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setLoading(false);
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


