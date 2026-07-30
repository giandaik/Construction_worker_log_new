/**
 * Mobile-only passthrough layout for `/projects/[id]` — see the sibling
 * `worklogs/[id]/layout.tsx` for why `generateStaticParams()` lives in a layout.
 */

export function generateStaticParams() {
  return [{ id: MOBILE_SHELL_PARAM }];
}

/** Placeholder route segment — see `mobile/README.md` for the deep-link caveat. */
const MOBILE_SHELL_PARAM = "shell";

export default function ProjectIdLayout({ children }: { children: React.ReactNode }) {
  return children;
}
