"use client";

/**
 * Mobile-only replacement for `app/admin/projects/new/page.tsx` — see
 * `mobile/README.md`. The server-side admin gate becomes a client-side one.
 */

import { NewProjectForm } from "@/components/admin/NewProjectForm";
import { MobileAdminGate } from "@/components/mobile/MobileAdminGate";

export default function AdminNewProjectPage() {
  return (
    <MobileAdminGate>
      <div className="container mx-auto max-w-2xl px-4 py-6 sm:py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">New Project</h1>
        </div>
        <NewProjectForm />
      </div>
    </MobileAdminGate>
  );
}
