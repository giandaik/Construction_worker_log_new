"use client";

/**
 * Mobile-only replacement for `app/projects/[id]/edit/page.tsx` — see
 * `mobile/README.md`. Reads the project id from the client router instead of
 * the server `params` promise, and gates on the client.
 */

import { EditProjectForm } from "@/components/admin/EditProjectForm";
import { MobileAdminGate } from "@/components/mobile/MobileAdminGate";
import { useRouteId } from "@/lib/native-route";

export default function EditProjectPage() {
  const projectId = useRouteId();

  return (
    <MobileAdminGate>
      <div className="container mx-auto max-w-2xl px-4 py-6 sm:py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Edit Project</h1>
        </div>
        <EditProjectForm projectId={projectId} />
      </div>
    </MobileAdminGate>
  );
}
