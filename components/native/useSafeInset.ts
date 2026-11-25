"use client"

import { useEffect, useState } from "react"

/**
 * Notch / home-indicator insets, measured rather than trusted.
 *
 * `env(safe-area-inset-*)` is only correct when the WebView is edge-to-edge and
 * the document declares `viewport-fit=cover`. WKWebView in a Capacitor shell
 * reports 0 for both when the viewport meta is missing — and then the 44 pt
 * nav bar draws under the clock. This hook measures the real value, and if the
 * engine says 0 while the WebView still covers the screen, falls back to the
 * inset for that screen height.
 */
const TOP_BY_SCREEN_HEIGHT: Record<number, number> = {
  667: 20, // SE 2/3
  736: 20, // 8 Plus
  812: 44, // X / 11 Pro / mini
  844: 47, // 12 / 13 / 14
  852: 59, // 14 Pro / 15 / 16
  896: 44, // XR / 11 / XS Max
  926: 47, // 14 Plus
  932: 59, // 14 Pro Max / 15 Plus / 16 Pro Max
}

function probe(edge: "top" | "bottom"): number {
  if (typeof document === "undefined") return 0
  const el = document.createElement("div")
  el.style.cssText = `position:fixed;left:0;${edge}:0;width:1px;height:env(safe-area-inset-${edge},0px);visibility:hidden;pointer-events:none`
  document.body.appendChild(el)
  const px = el.getBoundingClientRect().height
  el.remove()
  return Math.round(px)
}

/** True when the WebView covers the status bar (i.e. insets must be applied). */
function isEdgeToEdge(): boolean {
  return Math.abs(window.innerHeight - window.screen.height) <= 2
}

export function useSafeInset(edge: "top" | "bottom"): number {
  const [px, setPx] = useState(0)

  useEffect(() => {
    const measured = probe(edge)
    if (measured > 0) {
      setPx(measured)
      return
    }
    if (!isEdgeToEdge()) return
    if (edge === "top") {
      setPx(TOP_BY_SCREEN_HEIGHT[Math.round(window.screen.height)] ?? 47)
    } else {
      setPx(34)
    }
  }, [edge])

  return px
}
