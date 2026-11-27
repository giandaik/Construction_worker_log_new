"use client";

import { ProjectDetail } from "@/components/projects/ProjectDetail";
import { useRouteId } from "@/lib/native-route";

/**
 * `/projects/[id]` — and, on the device, `/projects/shell?id=…`.
 *
 * The site record lives in `components/projects/ProjectDetail` so the tablet
 * sites list can render the same body in its right-hand pane.
 */
export default function ProjectDetailPage() {
  const id = useRouteId();

  return <ProjectDetail id={id} />;
}
