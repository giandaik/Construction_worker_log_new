"use client"

/**
 * Mobile-only replacement for `app/page.tsx`.
 *
 * The web dashboard is a server component that queries MongoDB directly and
 * reads the session cookie via `getAuthUser()`. Neither works in a static
 * export, so the mobile shell renders the same dashboard from the JSON API.
 *
 * `scripts/build-mobile.mjs` copies this over `app/page.tsx` for the duration
 * of the mobile build and restores the original afterwards.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, FileText, FolderOpen, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PendingSubmissions } from "@/components/PendingSubmissions"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { FORM_STATUS_CLASSES, FORM_STATUS_LABELS } from "@/lib/constants/constantValues"
import type { Project, WorkLog } from "@/types/shared"
import { apiFetch } from "@/lib/apiClient"

const RECENT_LOGS_SHOWN = 6

interface DashboardProject extends Omit<Project, "_id"> {
  _id: string
}

interface DashboardWorkLog extends Omit<WorkLog, "_id" | "project"> {
  _id: string
  project: string
  status?: string
}

function StatCard({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-md border bg-card p-4 transition-shadow hover:shadow-md hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {body}
      </Link>
    )
  }

  return <div className="rounded-md border bg-card p-4 transition-shadow hover:shadow-md">{body}</div>
}

export default function MobileHomePage() {
  const { user } = useCurrentUser()
  const [projects, setProjects] = useState<DashboardProject[]>([])
  const [workLogs, setWorkLogs] = useState<DashboardWorkLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isActive = true

    async function loadDashboard() {
      try {
        const [projectsRes, workLogsRes] = await Promise.all([
          apiFetch("/api/projects"),
          apiFetch("/api/worklogs"),
        ])

        if (!isActive) return

        if (projectsRes.ok) setProjects(await projectsRes.json())
        if (workLogsRes.ok) setWorkLogs(await workLogsRes.json())
      } catch (error) {
        console.error("Error loading dashboard:", error)
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    loadDashboard()
    return () => {
      isActive = false
    }
  }, [])

  const isWorker = user?.role === "user"
  const recentLogs = workLogs.slice(0, RECENT_LOGS_SHOWN)
  const projectNames = new Map(projects.map((p) => [p._id, p.name]))
  const lastEntry = workLogs[0]?.date ? new Date(workLogs[0].date).toLocaleDateString() : "—"

  return (
    <div className="flex flex-col min-h-screen">
      <main className="container flex-1 px-4 py-8 md:px-6">
        {isWorker ? (
          <section className="animate-fade-up grid gap-4 sm:grid-cols-2">
            <StatCard label="Start today's log" value="New work log" hint="Record today's work" href="/logs/new" />
            <StatCard label="My logs" value="All work logs" href="/worklogs" />
          </section>
        ) : (
          <section className="animate-fade-up grid gap-4 sm:grid-cols-3">
            <StatCard label="Work logs" value={String(workLogs.length)} hint={`Last entry ${lastEntry}`} href="/worklogs" />
            <StatCard label="Projects" value={String(projects.length)} href="/projects" />
            <StatCard label="Quick start" value="New log" hint="Record today's work in minutes" href="/logs/new" />
          </section>
        )}

        <section className="mt-10 grid gap-8 lg:grid-cols-3">
          <div className="animate-fade-up lg:col-span-2" style={{ animationDelay: "80ms" }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold uppercase">Recent work logs</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/worklogs">
                  All logs <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : recentLogs.length === 0 ? (
              <div className="rounded-md border border-dashed bg-card p-10 text-center">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
                <p className="mt-3 text-muted-foreground">No work logs yet.</p>
                <Button className="mt-4" asChild>
                  <Link href="/logs/new">
                    <Plus className="mr-2 h-4 w-4" /> Create the first one
                  </Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y rounded-md border bg-card">
                {recentLogs.map((log) => (
                  <li key={log._id}>
                    <Link
                      href={`/worklogs/${log._id}`}
                      className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {projectNames.get(log.project) ?? "Unknown project"}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">{log.workDescription}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {log.status && (
                          <span
                            className={`status-badge hidden sm:inline-flex ${
                              FORM_STATUS_CLASSES[log.status as keyof typeof FORM_STATUS_CLASSES] ?? "status-unknown"
                            }`}
                          >
                            {FORM_STATUS_LABELS[log.status as keyof typeof FORM_STATUS_LABELS] ?? "N/A"}
                          </span>
                        )}
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {new Date(log.date).toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="animate-fade-up space-y-8" style={{ animationDelay: "160ms" }}>
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold uppercase">Projects</h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/projects">
                    All <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : projects.length === 0 ? (
                <div className="rounded-md border border-dashed bg-card p-8 text-center">
                  <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
                  <p className="mt-3 text-muted-foreground">No projects yet.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {projects.slice(0, 5).map((project) => (
                    <li key={project._id}>
                      <Link
                        href={`/projects/${project._id}`}
                        className="block rounded-md border bg-card px-4 py-3 transition-colors hover:bg-accent/50"
                      >
                        <p className="truncate font-medium">{project.name}</p>
                        {project.description && (
                          <p className="truncate text-sm text-muted-foreground">{project.description}</p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <PendingSubmissions initialData={{ projects, workLogs }} />
          </div>
        </section>
      </main>
    </div>
  )
}
