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
  title: 'Construction Log',
  description: 'Track and manage construction projects and daily work logs',
}

/**
 * `viewportFit: 'cover'` is what makes `env(safe-area-inset-*)` report real
 * numbers inside the Capacitor WebView. Without it the native shell draws its
 * 44 pt navigation bar underneath the status bar.
 */
const isNativeBundle = (process.env.NEXT_PUBLIC_API_BASE_URL || '').length > 0

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zoom stays available on the web — disabling it is an accessibility
  // violation there. Inside the Capacitor shell it is what stops a stray
  // pinch from breaking the fixed 44 pt chrome.
  maximumScale: isNativeBundle ? 1 : undefined,
  userScalable: isNativeBundle ? false : undefined,
  viewportFit: 'cover' as const,
  themeColor: '#ffffff',
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
