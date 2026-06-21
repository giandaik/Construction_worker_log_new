import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAuthUser, isAdmin } from "@/utils/auth";
import { Button } from "@/components/ui/button";
import { EditProjectForm } from "@/components/admin/EditProjectForm";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const authUser = await getAuthUser();

  if (!authUser) {
    redirect("/login");
  }

  if (!isAdmin(authUser)) {
    redirect("/");
  }

  const { id } = await params;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 sm:py-8">
      <div className="mb-6">
        <Button variant="ghost" asChild>
          <Link href={`/projects/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Project
          </Link>
        </Button>
      </div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Edit Project</h1>
      </div>
      <EditProjectForm projectId={id} />
    </div>
  );
}
