"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { nativeRoute } from "@/lib/native-route"

/**
 * Rewrites clicks on dynamic-route links to the shell page before Next's own
 * handler runs. Without it a static export has no file for `/worklogs/<id>`, and
 * the client router drops the navigation without an error — rows simply do not
 * open. Capture phase, so we win against the anchor's own handler.
 */
export function NativeRouteBridge({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return
      const target = event.target as HTMLElement | null
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute("href") || ""
      const mapped = nativeRoute(href)
      if (mapped === href) return
      event.preventDefault()
      event.stopPropagation()
      router.push(mapped)
    }

    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [router])

  return <>{children}</>
}
