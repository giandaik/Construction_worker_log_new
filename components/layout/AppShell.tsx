"use client"

import { usePathname } from "next/navigation"

import { Navbar } from "./Navbar"
import { Breadcrumbs } from "./Breadcrumbs"
import { NavBar } from "@/components/native/NavBar"
import { TabBar } from "@/components/native/TabBar"
import { NativeRouteBridge } from "@/components/native/NativeRouteBridge"

const PUBLIC_PATHS = ["/login", "/signup", "/sample-log", "/"]

/** True for routes that should render with no app chrome (landing, sign-in / sign-up). */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
}

/**
 * True when this bundle is the Capacitor build. `NEXT_PUBLIC_API_BASE_URL` is
 * inlined at build time by `scripts/build-mobile.mjs`, so both the server
 * render and the first client render agree — no flash of the web chrome.
 */
export function isNativeBundle(): boolean {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || "").length > 0
}

/**
 * Renders the native shell (44 pt nav bar + tab bar) in the Capacitor build and
 * the web chrome (navbar + breadcrumbs) everywhere else. Lives in the root
 * server layout; pages stay server-rendered because they arrive as `children`.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (isPublicPath(pathname)) return <>{children}</>

  if (isNativeBundle()) {
    return (
      <NativeRouteBridge>
        <div className="ios-surface min-h-dvh">
          <NavBar />
          <div className="ios-tabbar-space mx-auto max-w-md">{children}</div>
          <TabBar />
        </div>
      </NativeRouteBridge>
    )
  }

  return (
    <>
      <Navbar />
      <Breadcrumbs />
      {children}
    </>
  )
}
