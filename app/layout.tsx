import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "../components/session-provider"
import { Fira_Sans, Fira_Sans_Condensed } from "next/font/google"
import { cn } from "@/lib/utils"
import { SyncManager } from "@/components/SyncManager"
import { AppShell } from "@/components/layout/AppShell"
import { MobileInit } from "@/components/MobileInit"

// Fira covers Greek — the UI mixes Greek and English strings.
const fontSans = Fira_Sans({
  subsets: ["latin", "latin-ext", "greek"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
})

const fontDisplay = Fira_Sans_Condensed({
  subsets: ["latin", "latin-ext", "greek"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
})

export const metadata = {
  title: 'sitely',
  description: 'Track and manage construction projects and daily work logs',
}

/**
 * `viewportFit: 'cover'` lets the layout reach under the notch and the status
 * bar, which is what the Capacitor shell draws over. The insets that come with
 * it are consumed by `env(safe-area-inset-*)` in the app chrome — without
 * `cover` the WebView is inset by the OS and those values are always 0, so the
 * two have to be changed together.
 */
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable,
          fontDisplay.variable
        )}
      >
        {/* Native plugin boot (status bar, splash). Renders nothing on web. */}
        <MobileInit />
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <SyncManager />
            <AppShell>{children}</AppShell>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
