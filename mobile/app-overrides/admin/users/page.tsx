"use client";

/**
 * Mobile-only replacement for `app/admin/users/page.tsx` — the web version is a
 * server component that gates on `getAuthUser()`, which needs a request cookie.
 * Static export has no request, so the admin gate moves to the client.
 */

import Link from "next/link";
import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserManagement } from "@/components/admin/UserManagement";
import { MobileAdminGate } from "@/components/mobile/MobileAdminGate";

export default function AdminUsersPage() {
  return (
    <MobileAdminGate>
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">User Management</h1>
          <Button asChild>
            <Link href="/admin/projects/new">
              <FolderPlus className="mr-2 h-4 w-4" /> New Project
            </Link>
          </Button>
        </div>
        <UserManagement />
      </div>
    </MobileAdminGate>
  );
}
