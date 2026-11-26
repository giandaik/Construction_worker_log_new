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
 *
 * Layout follows `screens/02-home.html`: date subtitle → starter row → stat card
 * (two counters, hairline, a tight row of "Last entry" / "Signed records") →
 * recent logs with a trailing status pill on every row.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { OfflineBar } from "@/components/native/OfflineBar"
import { Glyph } from "@/components/native/icons"
import { Btn, Empty, LargeTitle, Pill, Row, Section, Skeleton, Stat } from "@/components/native/ui"
import { PendingSubmissions } from "@/components/PendingSubmissions"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import type { Project, WorkLog } from "@/types/shared"
import { apiFetch } from "@/lib/apiClient"

const RECENT_LOGS_SHOWN = 6

/**
 * Last dashboard the server sent, kept so the screen has something to draw
 * before the network answers.
 *
 * The shell re-opens on the same device all day; the data behind it changes
 * when the user adds a log, which is rare compared with how often the screen is
 * looked at. Painting the previous answer and refreshing behind it turns a
 * ~0.6 s wait into no wait, and the refresh still lands within the same second.
 * A payload that fails to parse is ignored — a cache miss is the safe state.
 */
const DASHBOARD_CACHE_KEY = "cwl.dashboard.v1"

interface DashboardSnapshot {
  projects: DashboardProject[]
  workLogs: DashboardWorkLog[]
  totalLogs: number
}

function readDashboardCache(): DashboardSnapshot | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(DASHBOARD_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DashboardSnapshot>
    if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.workLogs)) return null
    return {
      projects: parsed.projects,
      workLogs: parsed.workLogs,
      totalLogs: typeof parsed.totalLogs === "number" ? parsed.totalLogs : parsed.workLogs.length,
    }
  } catch {
    return null
  }
}

function writeDashboardCache(snapshot: DashboardSnapshot): void {
  try {
    window.localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(snapshot))
  } catch {
    // A full or disabled localStorage costs the next open its head start and
    // nothing else — the fetch below is the real source of truth.
  }
}

const STATUS_TONES: Record<string, "ok" | "warn" | "plan" | "draft"> = {
  submitted: "ok",
  completed: "ok",
  approved: "ok",
  pending: "warn",
  rejected: "warn",
  planned: "plan",
  draft: "draft",
}

function statusLabel(status?: string): string {
  if (!status) return "Draft"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

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
  // Read once, on first render: a cache hit means the first frame already has
  // the counters and the recent list, so the skeleton is never shown for a
  // device that has opened the screen before.
  const [snapshot] = useState(readDashboardCache)
  const [projects, setProjects] = useState<DashboardProject[]>(snapshot?.projects ?? [])
  const [workLogs, setWorkLogs] = useState<DashboardWorkLog[]>(snapshot?.workLogs ?? [])
  const [totalLogs, setTotalLogs] = useState<number>(snapshot?.totalLogs ?? (snapshot?.workLogs.length ?? 0))
  const [isLoading, setIsLoading] = useState(snapshot === null)

  useEffect(() => {
    let isActive = true

    async function loadDashboard() {
      try {
        // One request, not three: the route reads the same rows in parallel
        // behind a single auth check (see app/api/dashboard/route.ts).
        const response = await apiFetch("/api/dashboard")

        if (!isActive || !response.ok) return

        const data = (await response.json()) as Partial<DashboardSnapshot>
        if (!Array.isArray(data.projects) || !Array.isArray(data.workLogs)) return

        const next: DashboardSnapshot = {
          projects: data.projects,
          workLogs: data.workLogs,
          totalLogs: typeof data.totalLogs === "number" ? data.totalLogs : data.workLogs.length,
        }

        setProjects(next.projects)
        setWorkLogs(next.workLogs)
        setTotalLogs(next.totalLogs)
        writeDashboardCache(next)
      } catch (error) {
        // Offline keeps the cached screen; the offline bar already says so.
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
  const nameOf = (project: DashboardWorkLog["project"]): string => {
    if (project && typeof project === "object") {
      const populated = project as unknown as { name?: string }
      if (populated.name) return populated.name
    }
    if (typeof project === "string") return projectNames.get(project) ?? "Unknown site"
    return "Unknown site"
  }
  const lastEntry = workLogs[0]?.date
    ? new Date(workLogs[0].date).toLocaleDateString("en-GB")
    : "—"
  const signedCount = workLogs.filter((log) => log.status === "submitted" || log.status === "completed").length
  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date())

  // "Today's log is not started" — the design's starter row. Once anything is on
  // file for today the row is not drawn: the recent list below carries it.
  const todayKey = new Date().toISOString().slice(0, 10)
  const hasTodayLog = workLogs.some((log) => String(log.date ?? "").slice(0, 10) === todayKey)

  return (
    <div className="safe-b pb-6">
      <LargeTitle sub={today}>Home</LargeTitle>

      <OfflineBar>
        No signal. Today&rsquo;s log is saved on the phone and uploads when you reconnect.
      </OfflineBar>

      {isLoading ? (
        <Skeleton rows={4} />
      ) : (
        <>
          {!hasTodayLog ? (
            <Section>
              <Row
                href="/logs/new"
                chevron
                title={<span className="font-semibold">Today&rsquo;s log is not started</span>}
                subtitle="Pick the site and write the day&rsquo;s work."
                leading={<Glyph name="pen" size={22} />}
              />
            </Section>
          ) : null}

          <Section>
            <div className="flex divide-x divide-[color:var(--ios-sep)]">
              <Stat value={String(totalLogs)} label="Work logs" icon="logs" />
              <Stat value={String(projects.length)} label="Sites" icon="sites" />
            </div>
            <div className="mx-4 h-px bg-[color:var(--ios-sep)]" />
            <div className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-1.5">
              <span className="t-footnote text-[color:var(--ios-ink2)]">Last entry {lastEntry}</span>
              <span className="t-footnote text-[color:var(--ios-ink2)]">{signedCount} signed</span>
            </div>
          </Section>

          <Section
            title="Recent logs"
            icon="logs"
            action={
              workLogs.length > 0 ? (
                <Link href="/worklogs" className="ios-head-link t-footnote text-[color:var(--ios-tint)]">
                  All {totalLogs}
                </Link>
              ) : undefined
            }
          >
            {recentLogs.length === 0 ? (
              <Empty
                icon="doc"
                title="No work logs yet"
                text="Nothing is recorded on this account. Start with today's site."
              >
                <Btn href="/logs/new">Start today&#39;s log</Btn>
              </Empty>
            ) : (
              recentLogs.map((log) => (
                <Row
                  key={log._id}
                  href={`/worklogs/${log._id}`}
                  chevron
                  trailing={
                    log.status ? (
                      <Pill tone={STATUS_TONES[log.status] ?? "draft"}>{statusLabel(log.status)}</Pill>
                    ) : undefined
                  }
                >
                  <div className="t-body truncate font-semibold leading-[22px]">{nameOf(log.project)}</div>
                  <div className="t-subhead truncate leading-5 text-[color:var(--ios-ink2)]">
                    {log.workDescription?.split("\n")[0] || "No description"}
                  </div>
                  <div className="t-footnote tabular-nums text-[color:var(--ios-ink2)]">
                    {new Date(log.date).toLocaleDateString("en-GB")}
                  </div>
                </Row>
              ))
            )}
          </Section>

          {isWorker && recentLogs.length > 0 ? (
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
