"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, FolderOpen, House, Plus, User } from "lucide-react"

import { useCurrentUser } from "@/hooks/useCurrentUser"
import { isAdminRole, isPlatformUser } from "@/components/layout/navConfig"
import { prefetchJson } from "@/lib/cachedApi"
import { AccountSheet } from "./AccountSheet"

interface TabItem {
  href: string
  label: string
  icon: typeof House
  match: (path: string) => boolean
  isAction?: boolean
}

const TABS: TabItem[] = [
  { href: "/app", label: "Home", icon: House, match: (p) => p === "/app" },
  { href: "/worklogs", label: "Logs", icon: FileText, match: (p) => p.startsWith("/worklogs") },
  { href: "/logs/new", label: "New", icon: Plus, match: (p) => p.startsWith("/logs/new"), isAction: true },
  { href: "/projects", label: "Sites", icon: FolderOpen, match: (p) => p.startsWith("/projects") },
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
      <div className="mx-auto flex h-[49px] max-w-md items-stretch justify-around px-1">
        {TABS.map((tab) => {
          const active = tab.match(pathname)
          const Icon = tab.icon

          if (tab.isAction) {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label="New log"
                className="ios-tap flex flex-1 flex-col items-center justify-center"
              >
                <span
                  className="flex h-8 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--ios-accent)", color: "#111" }}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.5} />
                </span>
                <span className="t-caption mt-0.5 text-[color:var(--ios-ink2)]">{tab.label}</span>
              </Link>
            )
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className="ios-tap flex flex-1 flex-col items-center justify-center gap-0.5"
              style={{ color: active ? "var(--ios-tint)" : "var(--ios-ink2)" }}
            >
              <Icon className="h-[25px] w-[25px]" strokeWidth={active ? 2.2 : 1.8} />
              <span className="t-caption">{tab.label}</span>
            </Link>
          )
        })}

        {accountVisible && (
          <AccountSheet
            admin={admin}
            trigger={
              <button
                type="button"
                aria-label="Account"
                className="ios-tap flex flex-1 flex-col items-center justify-center gap-0.5 text-[color:var(--ios-ink2)]"
              >
                <User className="h-[25px] w-[25px]" strokeWidth={1.8} />
                <span className="t-caption">Account</span>
              </button>
            }
          />
        )}
      </div>
    </nav>
  )
}
