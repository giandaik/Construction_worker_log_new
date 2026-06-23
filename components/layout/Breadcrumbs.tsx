"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

export type DynamicKind = "project" | "worklog"

export interface Crumb {
  href: string
  /** Static label; omitted for dynamic segments resolved asynchronously. */
  label?: string
  dynamic?: { kind: DynamicKind; id: string }
}

const STATIC_LABELS: Record<string, string> = {
  "": "Home",
  projects: "Projects",
  worklogs: "Work Logs",
  admin: "Admin",
  users: "Users",
  forms: "Forms",
  new: "New",
  calendar: "Calendar",
  edit: "Edit",
}

/** Parent segment that introduces a dynamic id. */
const DYNAMIC_PARENTS: Record<string, DynamicKind> = {
  projects: "project",
  worklogs: "worklog",
}

/**
 * Pure pathname → crumb trail. Static segments get their label; an id
 * following "projects" or "worklogs" is marked dynamic (label resolved
 * by the component via fetch). Exported for unit testing.
 */
export function buildBreadcrumbTrail(pathname: string): Crumb[] {
  if (!pathname || pathname === "/") {
    return [{ href: "/", label: STATIC_LABELS[""] }]
  }

  const segments = pathname.split("/").filter(Boolean)
  const crumbs: Crumb[] = [{ href: "/", label: STATIC_LABELS[""] }]

  let href = ""
  segments.forEach((segment, index) => {
    href += "/" + segment
    const parent = segments[index - 1]
    const dynamicKind = DYNAMIC_PARENTS[parent]

    if (!(segment in STATIC_LABELS) && dynamicKind) {
      crumbs.push({ href, dynamic: { kind: dynamicKind, id: segment } })
    } else {
      crumbs.push({ href, label: STATIC_LABELS[segment] ?? segment })
    }
  })

  return crumbs
}

/** Persists resolved labels across navigations within the session. */
const labelCache = new Map<string, string>()

async function resolveDynamicLabel(kind: DynamicKind, id: string): Promise<string> {
  const url = kind === "project" ? `/api/projects/${id}` : `/api/worklogs/${id}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${kind} ${id} failed: ${res.status}`)
  const data = (await res.json()) as { name?: string; date?: string }
  if (kind === "project") return data.name || "Project"
  return data.date ? new Date(data.date).toLocaleDateString() : "Work Log"
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const trail = useMemo(() => buildBreadcrumbTrail(pathname), [pathname])
  const [labels, setLabels] = useState<Record<string, string>>({})
  const inFlight = useRef(new Set<string>())

  useEffect(() => {
    let cancelled = false

    for (const crumb of trail) {
      if (!crumb.dynamic) continue
      const key = `${crumb.dynamic.kind}:${crumb.dynamic.id}`
      if (labelCache.has(key) || inFlight.current.has(key)) continue

      inFlight.current.add(key)
      resolveDynamicLabel(crumb.dynamic.kind, crumb.dynamic.id)
        .then((label) => {
          labelCache.set(key, label)
          if (!cancelled) setLabels((prev) => ({ ...prev, [key]: label }))
        })
        .catch(() => {
          labelCache.set(key, "Detail")
          if (!cancelled) setLabels((prev) => ({ ...prev, [key]: "Detail" }))
        })
        .finally(() => {
          inFlight.current.delete(key)
        })
    }

    return () => {
      cancelled = true
    }
  }, [trail])

  if (trail.length <= 1) return null

  const lastIndex = trail.length - 1

  return (
    <nav aria-label="Breadcrumb" className="border-b bg-background">
      <ol className="container flex items-center gap-1 overflow-x-auto px-4 py-2 text-sm text-muted-foreground">
        {trail.map((crumb, index) => {
          const isLast = index === lastIndex
          const key = crumb.dynamic
            ? `${crumb.dynamic.kind}:${crumb.dynamic.id}`
            : crumb.href
          const resolved = crumb.dynamic
            ? labels[key] ?? labelCache.get(key)
            : crumb.label
          // Keep only the last two crumbs on mobile to avoid overflow.
          const hiddenOnMobile = index < lastIndex - 1
          const liClass = hiddenOnMobile ? "hidden sm:flex" : "flex"

          return (
            <li key={key} className={`${liClass} items-center gap-1`}>
              {index > 0 && (
                <ChevronRight
                  className={hiddenOnMobile ? "hidden sm:block" : "block"}
                  size={16}
                  aria-hidden
                />
              )}
              {resolved === undefined ? (
                <span
                  className="inline-block h-3 w-12 animate-pulse rounded bg-muted align-middle"
                  aria-hidden
                />
              ) : isLast ? (
                <span className="truncate font-medium text-foreground" aria-current="page">
                  {resolved}
                </span>
              ) : (
                <Link href={crumb.href} className="whitespace-nowrap hover:text-foreground">
                  {resolved}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
