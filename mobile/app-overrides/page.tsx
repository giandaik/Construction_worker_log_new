"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Mobile-only replacement for `app/page.tsx`.
 *
 * The web landing page is a marketing page — irrelevant inside the native
 * app shell. The Capacitor static export cannot use the web middleware
 * redirects (no server), so this tiny page bounces the WebView straight to
 * the authenticated home.
 *
 * `scripts/build-mobile.mjs` copies this over `app/page.tsx` for the duration
 * of the mobile build and restores the original afterwards.
 */
export default function MobileLandingRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/app")
  }, [router])

  return null
}
