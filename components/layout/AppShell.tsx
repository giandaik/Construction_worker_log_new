"use client"

import { usePathname } from "next/navigation"

import { Navbar } from "./Navbar"
import { Breadcrumbs } from "./Breadcrumbs"

const PUBLIC_PATHS = ["/login", "/signup"]

/** True for routes that should render with no app chrome (sign-in / sign-up). */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
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
