"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { usePathname } from "next/navigation"

import { useCurrentUser } from "@/hooks/useCurrentUser"
import { isPlatformUser } from "@/components/layout/navConfig"
import { useSafeInset } from "./useSafeInset"
import { Glyph, type GlyphName } from "./icons"

interface RouteChrome {
  title: string
  icon?: GlyphName
  back?: boolean
  newLog?: boolean
}

/** One place that decides the nav bar for every route, so titles cannot drift. */
export function chromeFor(pathname: string): RouteChrome {
  // A static-export bundle is loaded as `/calendar.html` when the file is opened
  // directly (simulator install, a cold WebView load), and as `/calendar` after a
  // client-side push. Normalise so both spellings pick the same chrome.
  pathname = pathname.replace(/\.html$/, "") || "/"
  // Tab roots carry a large title of their own — repeating it in the bar is the
  // one thing the iOS grammar never does.
  if (pathname === "/app") return { title: "", newLog: true }
  if (pathname === "/worklogs") return { title: "", newLog: true }
  if (pathname === "/logs/new") return { title: "New log", icon: "pen", back: true }
  if (/^\/worklogs\/[^/]+\/edit$/.test(pathname)) return { title: "Edit log", icon: "pen", back: true }
  if (/^\/worklogs\/[^/]+$/.test(pathname)) return { title: "Work log", icon: "doc", back: true }
  if (/^\/projects\/shell(\/calendar)?$/.test(pathname))
    return {
      title: pathname.endsWith("calendar") ? "Calendar" : "Site",
      icon: pathname.endsWith("calendar") ? "calendar" : "pin",
      back: true,
    }
  if (pathname === "/projects") return { title: "", newLog: true }
  if (pathname === "/calendar") return { title: "Calendar", icon: "calendar", newLog: true }
  if (/^\/projects\/[^/]+\/calendar$/.test(pathname)) return { title: "Calendar", icon: "calendar", back: true }
  if (/^\/projects\/[^/]+\/edit$/.test(pathname)) return { title: "Edit site", icon: "pen", back: true }
  if (/^\/projects\/[^/]+$/.test(pathname)) return { title: "Site", icon: "pin", back: true }
  if (pathname === "/admin/users") return { title: "Admin", icon: "shield", back: true }
  if (pathname === "/admin/projects/new") return { title: "New site", icon: "pin", back: true }
  if (pathname === "/select-tenant") return { title: "Choose workspace", icon: "cube" }
  if (pathname.startsWith("/platform")) return { title: "Platform", icon: "shield", back: pathname !== "/platform" }
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
            <Glyph name="chevLeft" size={22} />
          </button>
        ) : (
          <span className="w-11" />
        )}

        <h1 className="pointer-events-none absolute inset-x-0 flex items-center justify-center gap-1.5 text-[17px] font-semibold leading-[22px]">
          {chrome.icon ? <Glyph name={chrome.icon} size={17} className="shrink-0" /> : null}
          <span>{chrome.title}</span>
        </h1>

        {showNewLog ? (
          <Link
            href="/logs/new"
            aria-label="New log"
            className="ios-tap ml-auto flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--ios-accent)] text-[#111] shadow-sm"
          >
            <Glyph name="plus" size={21} strokeWidth={2} />
          </Link>
        ) : (
          <span className="ml-auto w-11" />
        )}
      </div>
    </header>
  )
}
