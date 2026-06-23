"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HardHat, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { LogoutButton } from "@/components/LogoutButton"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { NAV_LINKS, isNavLinkVisible } from "./navConfig"

/** Home is active only on exact "/"; section links are prefix-active. */
export function isPathActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(href + "/")
}

export function Navbar() {
  const pathname = usePathname()
  const { user } = useCurrentUser()
  const links = NAV_LINKS.filter((link) => isNavLinkVisible(link, user?.role))

  return (
    <header className="sticky top-0 z-40 border-b bg-card">
      <div className="hazard-stripe h-1.5" />
      <div className="container flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href="/"
            className="flex items-center gap-2"
            aria-label="Construction Worker Log home"
          >
            <HardHat className="h-6 w-6 text-primary" aria-hidden />
            <span className="hidden text-lg font-bold uppercase tracking-tight md:inline">
              ΗΜΕΡΟΛΟΓΙΟ ΕΡΓΑΣΙΩΝ
            </span>
          </Link>

          <nav className="flex flex-wrap items-center gap-1" aria-label="Primary">
            {links.map((link) => {
              const active = isPathActive(pathname, link.href)
              const Icon = link.icon
              return (
                <Button
                  key={link.href}
                  variant={active ? "secondary" : "ghost"}
                  size="sm"
                  asChild
                >
                  <Link href={link.href} aria-current={active ? "page" : undefined}>
                    <Icon className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">{link.label}</span>
                  </Link>
                </Button>
              )
            })}
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button asChild size="sm">
            <Link href="/forms/new">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">New Form</span>
              <span className="sm:hidden">New</span>
            </Link>
          </Button>
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
    </header>
  )
}
