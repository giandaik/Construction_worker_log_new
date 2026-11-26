"use client"

import { useEffect, useState } from "react"

import { Glyph } from "./icons"

/**
 * The design's `.offline` bar (`screens/02-home.html`, `03-logs.html`,
 * `08-project.html`): a warn-tinted strip under the large title that says what
 * will sync. It is drawn hidden and revealed by state, so the screen never
 * reflows when the connection drops — only the strip appears.
 *
 * `navigator.onLine` is the only signal the WebView gives us without a probe;
 * the copy is per screen because "what will sync" differs (a list, one record,
 * today's log).
 */
export function OfflineBar({ children }: { children: React.ReactNode }) {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine)
    sync()
    window.addEventListener("online", sync)
    window.addEventListener("offline", sync)
    return () => {
      window.removeEventListener("online", sync)
      window.removeEventListener("offline", sync)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="status"
      className="mx-4 mb-4 flex items-start gap-2 rounded-[10px] bg-[#FFF1D6] px-3 py-2.5 text-[13px] font-medium leading-[18px] text-[#7A5200]"
    >
      <Glyph name="cloudOff" size={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}
