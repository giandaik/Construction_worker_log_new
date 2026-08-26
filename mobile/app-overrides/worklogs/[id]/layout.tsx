/**
 * Mobile-only passthrough layout for `/worklogs/[id]`.
 *
 * `output: 'export'` refuses to build a dynamic segment without
 * `generateStaticParams()`, and the pages under this segment are client
 * components (which cannot export it). A server layout can, so the segment gets
 * one here. Ids are only known at runtime on the device, so a single shell page
 * is emitted and the id is read client-side via `useParams()`.
 */

export function generateStaticParams() {
  return [{ id: MOBILE_SHELL_PARAM }];
}

/** Placeholder route segment — see `mobile/README.md` for the deep-link caveat. */
const MOBILE_SHELL_PARAM = "shell";

export default function WorkLogIdLayout({ children }: { children: React.ReactNode }) {
  return children;
}
