import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "../components/session-provider"
import { Fira_Sans, Fira_Sans_Condensed } from "next/font/google"
import { cn } from "@/lib/utils"
import { SyncManager } from "@/components/SyncManager"

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
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <SyncManager />
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
