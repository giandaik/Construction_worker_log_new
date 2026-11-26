/**
 * Month calendar of every log — the design's fifth section (`screens/09-calendar.html`).
 *
 * The product only had a per-site calendar behind Sites → project, so the tab bar
 * had no Calendar slot. This screen is the brief's version: a month grid with a dot
 * on every day that has a log, the selected day's logs listed underneath, and an
 * empty state that offers today's log. Search lives in the Logs nav bar, not here.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

import { OfflineBar } from "@/components/native/OfflineBar"
import { Glyph } from "@/components/native/icons"
import { Btn, Empty, Pill, Section, Skeleton } from "@/components/native/ui"
import { apiFetch } from "@/lib/apiClient"
import { isNativeBundle } from "@/lib/native-mode"

interface CalendarLog {
  _id: string
  date: string
  workDescription?: string
  status?: string
  project?: { _id?: string; name?: string } | string
}

interface CalendarProject {
  _id: string
  name: string
}

const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"]

const STATUS_TONES: Record<string, "ok" | "warn" | "plan" | "draft"> = {
  submitted: "ok",
  completed: "ok",
  approved: "ok",
  pending: "warn",
  rejected: "warn",
  planned: "plan",
  draft: "draft",
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number)
  const shifted = new Date(year, monthNumber - 1 + delta, 1)
  return monthKey(shifted)
}

/** Locale pinned so the static export and the client agree on the label. */
function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number)
  return new Date(year, monthNumber - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
}

function longDayLabel(month: string, day: number): string {
  const [year, monthNumber] = month.split("-").map(Number)
  return new Date(year, monthNumber - 1, day).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

function dateKeyFromValue(value: string): string {
  // Dates arrive either as ISO strings or as `YYYY-MM-DD`; both start with the
  // day, and slicing avoids a timezone shift from `new Date()` + local getters.
  return String(value).slice(0, 10)
}

function dayNumber(value: string): string {
  const key = dateKeyFromValue(value)
  const [, , day] = key.split("-")
  return day ? String(Number(day)) : ""
}

function shortDate(value: string): string {
  const key = dateKeyFromValue(value)
  const [year, month, day] = key.split("-").map(Number)
  if (!year || !month || !day) return key
  return new Date(year, month - 1, day).toLocaleDateString("en-GB")
}

export default function CalendarPage() {
  const [logs, setLogs] = useState<CalendarLog[]>([])
  const [projects, setProjects] = useState<CalendarProject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [selectedDay, setSelectedDay] = useState<number | null>(() => new Date().getDate())

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [logsRes, projectsRes] = await Promise.all([
          apiFetch("/api/worklogs"),
          apiFetch("/api/projects"),
        ])
        if (!active) return
        if (logsRes.ok) setLogs(await logsRes.json())
        else setError("Could not load logs")
        if (projectsRes.ok) setProjects(await projectsRes.json())
      } catch (e) {
        console.error(e)
        if (active) setError("Could not load logs")
      } finally {
        if (active) setIsLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const projectNames = useMemo(() => {
    const byId = new Map(projects.map((p) => [p._id, p.name]))
    return (log: CalendarLog): string => {
      if (log.project && typeof log.project === "object" && log.project.name) return log.project.name
      if (typeof log.project === "string") return byId.get(log.project) ?? "Unknown site"
      return "Unknown site"
    }
  }, [projects])

  /** day-of-month → logs on that day, for the visible month only. */
  const byDay = useMemo(() => {
    const map = new Map<number, CalendarLog[]>()
    for (const log of logs) {
      if (!log.date || dateKeyFromValue(log.date).slice(0, 7) !== month) continue
      const day = Number(dayNumber(log.date))
      if (!day) continue
      const list = map.get(day) ?? []
      list.push(log)
      map.set(day, list)
    }
    return map
  }, [logs, month])

  const loggedDays = byDay.size
  const today = new Date()
  const todayKey = monthKey(today)
  const isCurrentMonth = month === todayKey

  const { leadingBlanks, daysInMonth, previousMonthDays, totalCells } = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number)
    const firstWeekday = new Date(year, monthNumber - 1, 1).getDay() // 0 = Sunday
    const mondayFirst = (firstWeekday + 6) % 7
    const days = new Date(year, monthNumber, 0).getDate()
    const previousDays = new Date(year, monthNumber - 1, 0).getDate()
    return {
      leadingBlanks: mondayFirst,
      daysInMonth: days,
      previousMonthDays: previousDays,
      totalCells: Math.ceil((mondayFirst + days) / 7) * 7,
    }
  }, [month])

  // The web build keeps the desktop calendar route's own page; this screen is the
  // native shell's Calendar tab, and it is the only calendar a phone needs.
  if (!isNativeBundle()) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="mt-2 text-muted-foreground">
          Open the app on a phone for the month calendar, or pick a site from Sites.
        </p>
      </div>
    )
  }

  const selectedLogs = selectedDay ? byDay.get(selectedDay) ?? [] : []
  const trailing = totalCells - leadingBlanks - daysInMonth
  const stepMonth = (delta: number) => {
    setMonth(shiftMonth(month, delta))
    setSelectedDay(null)
  }

  return (
    <div className="pb-6">
      <OfflineBar>
        No signal. The dots show what is on this phone; logs written now upload when you
        reconnect.
      </OfflineBar>

      <div className="flex items-end gap-2 px-4 pb-1 pt-2">
        <div className="min-w-0 flex-1">
          <h1 className="t-title2 tabular-nums">{monthLabel(month)}</h1>
          <p className="t-footnote t-secondary mt-0.5">
            {isLoading
              ? "Loading logs…"
              : `${loggedDays} logged day${loggedDays === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="-mr-2 flex shrink-0">
          <button
            type="button"
            onClick={() => stepMonth(-1)}
            aria-label="Previous month"
            className="ios-tap flex h-11 w-11 items-center justify-center text-[color:var(--ios-tint)]"
          >
            <Glyph name="chevLeft" size={20} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => stepMonth(1)}
            aria-label="Next month"
            className="ios-tap flex h-11 w-11 items-center justify-center text-[color:var(--ios-tint)]"
          >
            <Glyph name="chevRight" size={20} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {error ? (
        <Section title="Could not load" icon="cloudOff">
          <div className="px-4 py-7 text-center">
            <p className="t-footnote text-[#c0392b]">{error}</p>
            <div className="mt-3 flex justify-center">
              <Btn variant="secondary" onClick={() => window.location.reload()}>
                Retry
              </Btn>
            </div>
          </div>
        </Section>
      ) : isLoading ? (
        <Skeleton rows={3} />
      ) : (
        <>
          <div className="mx-4 mt-2 grid grid-cols-7" aria-hidden>
            {WEEKDAY_INITIALS.map((label, index) => (
              <div
                key={`${label}-${index}`}
                className="flex h-[26px] items-center justify-center text-[11px] font-semibold uppercase leading-[13px] tracking-[0.04em] text-[color:var(--ios-ink2)]"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="mx-2 grid grid-cols-7" role="group" aria-label={monthLabel(month)}>
            {Array.from({ length: leadingBlanks }).map((_, index) => (
              <div key={`lead-${index}`} aria-hidden className="flex h-11 items-center justify-center">
                <span className="flex h-[30px] w-8 items-center justify-center text-[15px] leading-none text-[color:var(--ios-ink2)] opacity-40">
                  {previousMonthDays - leadingBlanks + index + 1}
                </span>
              </div>
            ))}

            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1
              const dayLogs = byDay.get(day)
              const hasLog = !!dayLogs?.length
              const isSelected = selectedDay === day
              const isToday = isCurrentMonth && today.getDate() === day

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  aria-pressed={isSelected}
                  aria-label={`${longDayLabel(month, day)}${
                    hasLog ? ` — ${dayLogs!.length} log${dayLogs!.length === 1 ? "" : "s"}` : ""
                  }`}
                  className="flex h-11 flex-col items-center justify-center gap-[2px]"
                >
                  <span
                    className={`flex h-[30px] w-8 items-center justify-center rounded-full text-[15px] leading-none tabular-nums ${
                      isSelected
                        ? "bg-[color:var(--ios-accent)] font-bold text-[#111]"
                        : isToday
                          ? "font-bold text-[color:var(--ios-ink)] ring-[1.5px] ring-[color:var(--ios-ink)]"
                          : hasLog
                            ? "font-semibold text-[color:var(--ios-ink)]"
                            : "text-[color:var(--ios-ink)]"
                    }`}
                  >
                    {day}
                  </span>
                  <span
                    aria-hidden
                    className={`h-[5px] w-[5px] rounded-full ${
                      isSelected ? "bg-transparent" : hasLog ? "bg-[color:var(--ios-ink2)]" : "bg-transparent"
                    }`}
                  />
                </button>
              )
            })}

            {Array.from({ length: trailing }).map((_, index) => (
              <div key={`trail-${index}`} aria-hidden className="flex h-11 items-center justify-center">
                <span className="flex h-[30px] w-8 items-center justify-center text-[15px] leading-none text-[color:var(--ios-ink2)] opacity-40">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {!isLoading && !error ? (
        <Section
          title={selectedDay ? longDayLabel(month, selectedDay) : "Pick a day"}
          icon="logs"
          action={
            selectedDay && selectedLogs.length > 0 ? (
              <Link
                href={`/logs/new`}
                className="ios-head-link t-footnote font-medium text-[color:var(--ios-tint)]"
              >
                Add a log
              </Link>
            ) : undefined
          }
        >
          {!selectedDay ? (
            <Empty
              icon="calendar"
              title="No day selected"
              text="Pick a day with a dot to read its logs."
            />
          ) : selectedLogs.length === 0 ? (
            <Empty
              icon="calendar"
              title="No logs on this day"
              text="Pick another day with a dot, or add today's log."
            >
              <Btn variant="secondary" href="/logs/new">
                Add a log
              </Btn>
            </Empty>
          ) : (
            selectedLogs.map((log) => (
              <Link
                key={log._id}
                href={`/worklogs/${log._id}`}
                className="relative flex min-h-[52px] items-center gap-3 px-4 py-2 [&+&]:before:absolute [&+&]:before:left-4 [&+&]:before:right-0 [&+&]:before:top-0 [&+&]:before:h-[0.5px] [&+&]:before:bg-[color:var(--ios-sep)] [&+&]:relative active:bg-black/[0.04]"
              >
                <div className="min-w-0 flex-1">
                  <div className="t-body truncate font-semibold leading-[22px]">
                    {projectNames(log)}
                  </div>
                  <div className="t-subhead truncate leading-5 text-[color:var(--ios-ink2)]">
                    {log.workDescription?.split("\n")[0] || "No description"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {log.status ? (
                    <Pill tone={STATUS_TONES[log.status] ?? "draft"}>
                      {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                    </Pill>
                  ) : null}
                  <Glyph name="chevRight" size={16} className="text-[#8A8A8E]" />
                </div>
              </Link>
            ))
          )}
        </Section>
      ) : null}

      {!isLoading && !error && selectedDay && selectedLogs.length > 0 ? (
        <p className="t-footnote t-secondary mt-3 px-4">
          {shortDate(`${month}-${String(selectedDay).padStart(2, "0")}`)} ·{" "}
          {selectedLogs.length} log{selectedLogs.length === 1 ? "" : "s"} on file
        </p>
      ) : null}
    </div>
  )
}
