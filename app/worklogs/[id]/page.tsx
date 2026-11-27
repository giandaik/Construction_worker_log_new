"use client";

import { WorkLogDetail } from "@/components/worklogs/WorkLogDetail";
import { useRouteId } from "@/lib/native-route";

/**
 * `/worklogs/[id]` — and, on the device, `/worklogs/shell?id=…`.
 *
 * The record itself lives in `components/worklogs/WorkLogDetail` so the tablet
 * logs list can render the same body in its right-hand pane without a second
 * copy of the fetch, the signatures, the approvals or the exports.
 */
export default function WorkLogDetailPage() {
  const id = useRouteId();

  return <WorkLogDetail id={id} />;
}
