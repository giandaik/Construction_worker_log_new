"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { isNativeBundle } from "./native-mode"

/**
 * Static-export routing for dynamic ids.
 *
 * `output: 'export'` can only emit one page per dynamic segment, so the native
 * bundle ships `/worklogs/shell` and `/projects/shell` and carries the real id in
 * `?id=`. A `<Link href="/worklogs/abc123">` has no file to load, and Next's
 * client router silently aborts the navigation — every list row looks dead.
 * `nativeRoute()` maps such hrefs onto the shell page, and `useRouteId()` reads
 * the id back out. On web both are pass-throughs.
 */

const DYNAMIC_ROUTE = /^\/(worklogs|projects)\/([^/?#]+)(\/[^?#]*)?(\?.*)?$/

export function nativeRoute(href: string): string {
  if (!isNativeBundle()) return href
  const match = DYNAMIC_ROUTE.exec(href)
  if (!match) return href

  const [, segment, id, rest = "", query = ""] = match
  if (id === "shell" || !id) return href

  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query)
  params.set("id", decodeURIComponent(id))
  return `/${segment}/shell${rest}?${params.toString()}`
}

/**
 * The id of the current dynamic route, on web or inside the native shell.
 *
 * Reads `window.location` rather than `useSearchParams()`: a static export would
 * demand a Suspense boundary around every page that called it.
 */
export function useRouteId(): string {
  const params = useParams<{ id?: string | string[] }>()
  const fromPath =
    typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : ""
  const pathId = fromPath && fromPath !== "shell" ? fromPath : ""
  const [queryId, setQueryId] = useState("")

  useEffect(() => {
    if (pathId) return
    setQueryId(new URLSearchParams(window.location.search).get("id") || "")
  }, [pathId])

  return pathId || queryId
}
