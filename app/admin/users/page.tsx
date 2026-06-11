import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAuthUser, isAdmin } from "@/utils/auth";
import { Button } from "@/components/ui/button";
import { UserManagement } from "@/components/admin/UserManagement";

export default async function AdminUsersPage() {
  const authUser = await getAuthUser();

  if (!authUser) {
    redirect("/login");
  }

  if (!isAdmin(authUser)) {
    redirect("/");
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6">
        <Button variant="ghost" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Link>
        </Button>
      </div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
      </div>
      <UserManagement />
    </div>
  );
}
