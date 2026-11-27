"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { useCurrentUser } from "@/hooks/useCurrentUser"
import { isAdminRole, isPlatformUser } from "@/components/layout/navConfig"
import { AccountSheet } from "./AccountSheet"
import { Glyph, type GlyphName } from "./icons"

interface RailItem {
  href: string
  label: string
  icon: GlyphName
  match: (path: string) => boolean
}

/**
 * Same five destinations as the phone tab bar, in the same order — the tablet
 * rail is the tab bar turned on its side, not a second information architecture.
 */
const ITEMS: RailItem[] = [
  { href: "/app", label: "Home", icon: "home", match: (p) => p === "/app" },
  { href: "/worklogs", label: "Logs", icon: "logs", match: (p) => p.startsWith("/worklogs") },
  { href: "/projects", label: "Sites", icon: "sites", match: (p) => p.startsWith("/projects") },
  { href: "/calendar", label: "Calendar", icon: "calendar", match: (p) => p.startsWith("/calendar") },
]

/**
 * Tablet navigation rail (iPad + Android tablets).
 *
 * Rendered in the native shell at every width and hidden below 720 px by CSS,
 * so the phone keeps its bottom tab bar and nothing is decided in JavaScript
 * (a runtime matchMedia branch would disagree with the server render).
 *
 * 720–999 px: 88 px icon rail, labels hidden, active item = accent-filled chip
 * (the same treatment `.ios-tabbar-item[aria-current]` uses).
 * ≥ 1000 px: 260 px sidebar, labels shown, brand wordmark shown.
 */
export function Rail() {
  const pathname = usePathname() || ""
  const { user } = useCurrentUser()

  const accountVisible = !isPlatformUser(user?.platformRole)
  const admin = isAdminRole(user?.role) && !isPlatformUser(user?.platformRole)

  return (
    <nav aria-label="Primary" className="native-rail">
      <div className="rail-brand">
        <span aria-hidden className="rail-mark">
          CL
        </span>
        <span className="rail-wordmark">Construction Log</span>
      </div>

      <ul className="rail-items">
        {ITEMS.map((item) => {
          const active = item.match(pathname)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="rail-item"
              >
                <span className="rail-chip">
                  <Glyph name={item.icon} size={21} strokeWidth={active ? 2 : 1.7} />
                </span>
                <span className="rail-label">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      {accountVisible && (
        <div className="rail-foot">
          <AccountSheet
            admin={admin}
            trigger={
              <button type="button" aria-label="Profile" className="rail-item">
                <span className="rail-chip">
                  <Glyph name="profile" size={21} />
                </span>
                <span className="rail-label">Profile</span>
              </button>
            }
          />
        </div>
      )}
    </nav>
  )
}
