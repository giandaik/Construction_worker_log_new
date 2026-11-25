"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { usePathname } from "next/navigation"
import { ChevronLeft, Plus } from "lucide-react"

import { useCurrentUser } from "@/hooks/useCurrentUser"
import { isPlatformUser } from "@/components/layout/navConfig"
import { useSafeInset } from "./useSafeInset"

interface RouteChrome {
  title: string
  back?: boolean
  newLog?: boolean
}

/** One place that decides the nav bar for every route, so titles cannot drift. */
export function chromeFor(pathname: string): RouteChrome {
  // Tab roots carry a large title of their own — repeating it in the bar is the
  // one thing the iOS grammar never does.
  if (pathname === "/app") return { title: "", newLog: true }
  if (pathname === "/worklogs") return { title: "", newLog: true }
  if (pathname === "/logs/new") return { title: "New log", back: true }
  if (/^\/worklogs\/[^/]+\/edit$/.test(pathname)) return { title: "Edit log", back: true }
  if (/^\/worklogs\/[^/]+$/.test(pathname)) return { title: "Work log", back: true }
  if (/^\/projects\/shell(\/calendar)?$/.test(pathname)) return { title: pathname.endsWith("calendar") ? "Calendar" : "Site", back: true }
  if (pathname === "/projects") return { title: "", newLog: true }
  if (/^\/projects\/[^/]+\/calendar$/.test(pathname)) return { title: "Calendar", back: true }
  if (/^\/projects\/[^/]+\/edit$/.test(pathname)) return { title: "Edit site", back: true }
  if (/^\/projects\/[^/]+$/.test(pathname)) return { title: "Site", back: true }
  if (pathname === "/admin/users") return { title: "Admin", back: true }
  if (pathname === "/admin/projects/new") return { title: "New site", back: true }
  if (pathname === "/select-tenant") return { title: "Choose workspace" }
  if (pathname.startsWith("/platform")) return { title: "Platform", back: pathname !== "/platform" }
  return { title: "Construction Log" }
}

/**
 * 44 pt navigation bar: centred 17 pt semibold title, chevron back on the left,
 * at most one trailing action. Sits under the status bar via `env()` inset, so
 * the WebView stops drawing content beneath the notch.
 */
export function NavBar() {
  const pathname = usePathname() || ""
  const router = useRouter()
  const { user } = useCurrentUser()
  const chrome = chromeFor(pathname)
  const safeTop = useSafeInset("top")

  const showNewLog = chrome.newLog && !isPlatformUser(user?.platformRole)

  return (
    <header
      className="safe-t sticky top-0 z-40 border-b bg-[color:var(--ios-card)]/95 backdrop-blur-xl"
      style={{ borderColor: "var(--ios-sep)", paddingTop: safeTop || undefined }}
    >
      <div className="relative mx-auto flex h-11 max-w-md items-center px-2">
        {chrome.back ? (
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            className="ios-tap -ml-1 flex items-center pr-2 text-[color:var(--ios-tint)]"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2.2} />
          </button>
        ) : (
          <span className="w-11" />
        )}

        <h1 className="pointer-events-none absolute inset-x-0 text-center text-[17px] font-semibold leading-[22px]">
          {chrome.title}
        </h1>

        {showNewLog ? (
          <Link
            href="/logs/new"
            aria-label="New log"
            className="ios-tap ml-auto flex items-center gap-1 pr-1 text-[color:var(--ios-tint)]"
          >
            <Plus className="h-6 w-6" strokeWidth={2.4} />
          </Link>
        ) : (
          <span className="ml-auto w-11" />
        )}
      </div>
    </header>
  )
}
