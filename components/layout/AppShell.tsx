"use client"

import { usePathname } from "next/navigation"

import { Navbar } from "./Navbar"
import { Breadcrumbs } from "./Breadcrumbs"
import { NavBar } from "@/components/native/NavBar"
import { TabBar } from "@/components/native/TabBar"
import { Rail } from "@/components/native/Rail"
import { NativeRouteBridge } from "@/components/native/NativeRouteBridge"
import { AndroidBackButton } from "@/components/native/AndroidBackButton"

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
        {/*
         * A real iOS shell: a viewport-height column of nav / scrolling content /
         * tab bar. The tab bar used to be `position: fixed; bottom: 0` over a
         * document scroller, which WKWebView re-anchors while the page bounces and
         * while `dvh` settles — the bar visibly drifts and can end up floating
         * above the home indicator with list rows showing underneath. In flow it
         * cannot move: the column owns the height and only the middle pane scrolls.
         */}
        <div className="ios-surface native-shell flex h-[100dvh] overflow-hidden">
          <AndroidBackButton />
          {/*
           * Tablet (≥720 px) turns this column into a row: the rail takes the
           * left edge and the nav / content / tab-bar column keeps the rest.
           * The tab bar stays in the markup — it is hidden by CSS on wide
           * screens, so the phone shell is untouched and the rail is the same
           * five destinations rather than a second navigation model.
           */}
          <Rail />
          <div className="native-col flex min-w-0 flex-1 flex-col">
            <NavBar />
            <main className="native-main min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</main>
            <TabBar />
          </div>
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
