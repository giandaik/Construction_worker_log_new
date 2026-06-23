import { redirect } from "next/navigation";
import { getAuthUser, isAdmin } from "@/utils/auth";
import { NewProjectForm } from "@/components/admin/NewProjectForm";

export default async function AdminNewProjectPage() {
  const authUser = await getAuthUser();

  if (!authUser) {
    redirect("/login");
  }

  if (!isAdmin(authUser)) {
    redirect("/");
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 sm:py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">New Project</h1>
      </div>
      <NewProjectForm />
    </div>
  );
}
