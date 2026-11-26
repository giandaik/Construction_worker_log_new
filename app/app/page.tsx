"use client"

/**
 * Mobile-only replacement for `app/app/page.tsx`.
 *
 * The web dashboard is a server component that queries MongoDB directly and
 * reads the session cookie via `getAuthUser()`. Neither works in a static
 * export, so the mobile shell renders the same dashboard from the JSON API.
 *
 * `scripts/build-mobile.mjs` copies this over `app/app/page.tsx` for the
 * duration of the mobile build and restores the original afterwards.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { Btn, LargeTitle, Row, Section, Skeleton, Stat } from "@/components/native/ui"
import { PendingSubmissions } from "@/components/PendingSubmissions"
import { useCurrentUser } from "@/hooks/useCurrentUser"
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
  const lastEntry = workLogs[0]?.date
    ? new Date(workLogs[0].date).toLocaleDateString("en-GB")
    : "—"
  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date())

  return (
    <div className="safe-b pb-6">
      <LargeTitle sub={today}>Today</LargeTitle>

      {isLoading ? (
        <Skeleton rows={4} />
      ) : (
        <>
          <Section footer={workLogs.length > 0 ? `Last entry ${lastEntry}` : undefined}>
            <div className="flex divide-x divide-[color:var(--ios-sep)]">
              <Stat value={String(workLogs.length)} label="Work logs" />
              <Stat value={String(projects.length)} label="Sites" />
            </div>
          </Section>

          <Section
            title="Recent logs"
            action={
              <Link href="/worklogs" className="t-footnote text-[color:var(--ios-tint)]">
                All logs
              </Link>
            }
          >
            {recentLogs.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="t-subhead t-secondary">No work logs yet.</p>
                <div className="mt-3 flex justify-center">
                  <Btn href="/logs/new">Start today&#39;s log</Btn>
                </div>
              </div>
            ) : (
              recentLogs.map((log) => (
                <Row
                  key={log._id}
                  href={`/worklogs/${log._id}`}
                  title={
                    <span className="font-semibold">
                      {projectNames.get(log.project) ?? "Unknown site"}
                    </span>
                  }
                  subtitle={
                    <span className="block truncate">
                      {`${new Date(log.date).toLocaleDateString("en-GB")} · ${
                        log.workDescription || "No description"
                      }`}
                    </span>
                  }
                  chevron
                />
              ))
            )}
          </Section>

          {isWorker ? (
            <div className="px-4 pt-5">
              <Btn block href="/logs/new">
                Log today&#39;s work
              </Btn>
            </div>
          ) : null}

          <PendingSubmissions initialData={{ projects, workLogs }} />
        </>
      )}
    </div>
  )
}
