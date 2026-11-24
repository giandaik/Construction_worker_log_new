"use client"

import { usePathname } from "next/navigation"

import { Navbar } from "./Navbar"
import { Breadcrumbs } from "./Breadcrumbs"

const PUBLIC_PATHS = ["/login", "/signup", "/sample-log", "/"]

/**
 * A static export also serves `/login.html` and `/index.html`, and the native
 * shell's WebView can be handed either form on a cold start — the bare route it
 * would match after a client-side navigation never happens for a link opened
 * from outside. Strip the suffix before matching, or the sign-in screen renders
 * with the signed-in navbar and breadcrumbs over it.
 */
function normalize(pathname: string): string {
  if (pathname.endsWith("/index.html")) return pathname.slice(0, -"/index.html".length) || "/"
  return pathname.replace(/\.html$/, "")
}

/** True for routes that should render with no app chrome (landing, sign-in / sign-up). */
export function isPublicPath(pathname: string): boolean {
  const path = normalize(pathname)
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"))
}

/**
 * Renders Navbar + Breadcrumbs on every authenticated route and nothing
 * extra on public routes. Lives in the root server layout; pages stay
 * server-rendered because they arrive as `children`.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (isPublicPath(pathname)) return <>{children}</>

  return (
    <>
      <Navbar />
      <Breadcrumbs />
      {children}
    </>
  )
}
