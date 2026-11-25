"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

/**
 * Android hardware back button.
 *
 * Without a listener Capacitor's default is to finish the activity, so pressing
 * back on a log detail screen leaves the app instead of returning to the list.
 * iOS never emits `backButton`, so this is a no-op there.
 *
 * At a tab root there is nothing to go back to, so a second press within two
 * seconds exits — the same behaviour as a native app.
 */

const TAB_ROOTS = ["/app", "/worklogs", "/projects"]

let lastRootPress = 0

export function AndroidBackButton() {
  const pathname = usePathname()

  useEffect(() => {
    let remove: (() => void) | undefined
    let cancelled = false

    ;(async () => {
      try {
        const { App } = await import("@capacitor/app")
        const handle = await App.addListener("backButton", () => {
          const atRoot = TAB_ROOTS.includes(pathname)
          if (!atRoot && window.history.length > 1) {
            window.history.back()
            return
          }
          const now = Date.now()
          if (now - lastRootPress < 2000) {
            void App.exitApp()
            return
          }
          lastRootPress = now
          if (atRoot) window.dispatchEvent(new Event("native:back-at-root"))
        })
        if (cancelled) {
          void handle.remove()
        } else {
          remove = () => void handle.remove()
        }
      } catch {
        // Plugin absent (web build or an older shell) — nothing to wire.
      }
    })()

    return () => {
      cancelled = true
      remove?.()
    }
  }, [pathname])

  return null
}
