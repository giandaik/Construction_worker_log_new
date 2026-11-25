/**
 * Mobile-only passthrough layout for `/platform/tenants/[id]` — the platform-admin
 * screens are web-only, but `output: "export"` still has to be given a parameter for
 * every dynamic segment. See `mobile/app-overrides/projects/[id]/layout.tsx` for why
 * `generateStaticParams()` lives in a layout rather than in the page.
 */

export function generateStaticParams() {
  return [{ id: MOBILE_SHELL_PARAM }];
}

/** Placeholder route segment — see `mobile/README.md` for the deep-link caveat. */
const MOBILE_SHELL_PARAM = "shell";

export default function PlatformTenantIdLayout({ children }: { children: React.ReactNode }) {
  return children;
}
