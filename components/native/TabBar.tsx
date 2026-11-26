"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useCurrentUser } from "@/hooks/useCurrentUser"
import { isAdminRole, isPlatformUser } from "@/components/layout/navConfig"
import { prefetchJson } from "@/lib/cachedApi"
import { AccountSheet } from "./AccountSheet"
import { Glyph, type GlyphName } from "./icons"

interface TabItem {
  href: string
  label: string
  icon: GlyphName
  match: (path: string) => boolean
  isAction?: boolean
}

const TABS: TabItem[] = [
  { href: "/app", label: "Home", icon: "home", match: (p) => p === "/app" },
  { href: "/worklogs", label: "Logs", icon: "logs", match: (p) => p.startsWith("/worklogs") },
  { href: "/logs/new", label: "New", icon: "plus", match: (p) => p.startsWith("/logs/new"), isAction: true },
  { href: "/projects", label: "Sites", icon: "sites", match: (p) => p.startsWith("/projects") },
]

/**
 * iOS tab bar for the Capacitor shell: 49 pt + home-indicator inset, hairline
 * top, one accent tint for the active item, and a raised centre action for the
 * only thing a field user does every day — open a new log.
 *
 * The Calendar tab from the design brief is deliberately absent: the product has
 * no global calendar route (it is per project), so the calendar lives behind
 * Sites → project, and the fifth slot carries Account instead.
 */
export function TabBar() {
  const pathname = usePathname() || ""
  const { user } = useCurrentUser()

  // Warm the two GETs the Logs tab needs while the user is still looking at
  // whatever brought them here. Inside the WebView each of those calls costs a
  // cross-origin round trip, and this is what turns the Logs tap into an
  // instant paint instead of a skeleton.
  useEffect(() => {
    const timer = setTimeout(() => {
      prefetchJson("worklogs:all", "/api/worklogs")
      prefetchJson("projects", "/api/projects", 5 * 60_000)
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  const accountVisible = !isPlatformUser(user?.platformRole)
  const admin = isAdminRole(user?.role) && !isPlatformUser(user?.platformRole)

  return (
    <nav
      aria-label="Primary"
      /*
       * In flow, at the bottom of the shell column — not fixed. Only the middle
       * pane scrolls, so there is nothing for the bar to drift against. The
       * home-indicator inset comes from env() alone: the old JS-measured inset
       * disagreed with the CSS spacer, and the two together are what pushed the
       * bar off the bottom edge.
       */
      className="shrink-0 border-t bg-[color:var(--ios-card)]"
      style={{ borderColor: "var(--ios-sep)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="ios-tabbar-row mx-auto max-w-md">
        {TABS.map((tab) => {
          const active = tab.match(pathname)

          if (tab.isAction) {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label="New log"
                className="ios-tabbar-item ios-tabbar-new"
              >
                <span className="ios-tabbar-chip">
                  <Glyph name={tab.icon} size={20} strokeWidth={2} />
                </span>
                <span className="ios-tabbar-label">{tab.label}</span>
              </Link>
            )
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className="ios-tabbar-item"
            >
              <span className="ios-tabbar-chip">
                <Glyph name={tab.icon} size={21} strokeWidth={active ? 2 : 1.7} />
              </span>
              <span className="ios-tabbar-label">{tab.label}</span>
            </Link>
          )
        })}

        {accountVisible && (
          <AccountSheet
            admin={admin}
            trigger={
              <button type="button" aria-label="Account" className="ios-tabbar-item">
                <span className="ios-tabbar-chip">
                  <Glyph name="profile" size={21} />
                </span>
                <span className="ios-tabbar-label">Account</span>
              </button>
            }
          />
        )}
      </div>
    </nav>
  )
}
