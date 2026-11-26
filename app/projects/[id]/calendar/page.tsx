// app/projects/[id]/calendar/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { isNativeBundle } from "@/lib/native-mode";
import { Row, Section, Skeleton as NativeSkeleton } from "@/components/native/ui";
import { Sheet } from "@/components/native/controls";
import { useRouteId } from "@/lib/native-route";

interface ProjectSummary {
  _id: string;
  name: string;
}

interface DayCount {
  date: string;
  count: number;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Native grid is Monday-first, as the approved calendar design is. */
const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(year, monthNumber - 1 + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

// Locale pinned so SSR (server locale) and client render the same text
function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function dayKey(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, "0")}`;
}

/** "Tuesday 24 November" — locale pinned so the native panel header is stable. */
function longDayLabel(month: string, day: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, day).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function ProjectCalendarPage() {
  const router = useRouter();
  const projectId = useRouteId();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [month, setMonth] = useState<string>(currentMonth());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(() => new Date().getDate());
  const [sitePickerOpen, setSitePickerOpen] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await apiFetch("/api/projects");
        if (!response.ok) throw new Error("Failed to fetch projects");
        setProjects(await response.json());
      } catch (e) {
        console.error(e);
        setError("Failed to load projects");
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    // Native shell resolves the id from `?id=` after mount.
    if (!projectId) return;
    const fetchCounts = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await apiFetch(
          `/api/projects/${projectId}/worklog-counts?month=${month}`
        );
        if (!response.ok) throw new Error("Failed to fetch worklog counts");
        const data: DayCount[] = await response.json();
        setCounts(
          data.reduce<Record<string, number>>((acc, entry) => {
            acc[entry.date] = entry.count;
            return acc;
          }, {})
        );
      } catch (e) {
        console.error(e);
        setError("Failed to load worklog counts");
      } finally {
        setIsLoading(false);
      }
    };
    fetchCounts();
  }, [projectId, month]);

  const projectName = useMemo(
    () => projects.find((project) => project._id === projectId)?.name,
    [projects, projectId]
  );

  const { leadingBlanks, daysInMonth } = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    return {
      leadingBlanks: new Date(year, monthNumber - 1, 1).getDay(),
      daysInMonth: new Date(year, monthNumber, 0).getDate(),
    };
  }, [month]);

  const todayKey = dayKey(currentMonth(), new Date().getDate());

  if (isNativeBundle()) {
    const loggedDays = Object.values(counts).filter((count) => count > 0).length;
    const selected =
      selectedDay !== null && selectedDay <= daysInMonth ? selectedDay : null;
    const selectedKey = selected !== null ? dayKey(month, selected) : null;
    const selectedCount = selectedKey ? counts[selectedKey] ?? 0 : 0;
    const mondayFirstBlanks = (leadingBlanks + 6) % 7;
    const [gridYear, gridMonth] = month.split("-").map(Number);
    const previousMonthDays = new Date(gridYear, gridMonth - 1, 0).getDate();
    const totalCells = Math.ceil((mondayFirstBlanks + daysInMonth) / 7) * 7;
    const trailingDays = totalCells - mondayFirstBlanks - daysInMonth;

    const stepMonth = (delta: number) => {
      setMonth(shiftMonth(month, delta));
      setSelectedDay(null);
    };

    return (
      <div className="pb-8">
        <Section title="Site" icon="pin">
          <Row
            onClick={() => setSitePickerOpen(true)}
            chevron
            title={projectName ?? "Choose a site"}
            subtitle={projects.length > 1 ? "Tap to switch site" : undefined}
          />
        </Section>

        <div className="mt-5 flex items-start gap-2 px-4">
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
              className="ios-tap flex items-center justify-center text-[color:var(--ios-tint)]"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.3} />
            </button>
            <button
              type="button"
              onClick={() => stepMonth(1)}
              aria-label="Next month"
              className="ios-tap flex items-center justify-center text-[color:var(--ios-tint)]"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2.3} />
            </button>
          </div>
        </div>

        {error ? (
          <p className="t-footnote mt-4 px-4 text-[#c0392b]">{error}</p>
        ) : isLoading ? (
          <NativeSkeleton rows={3} />
        ) : (
          <>
            <div className="mx-4 mt-3 grid grid-cols-7" aria-hidden>
              {WEEKDAY_INITIALS.map((label, index) => (
                <div
                  key={`${label}-${index}`}
                  className="t-caption pb-1 text-center font-semibold uppercase text-[color:var(--ios-ink2)]"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="mx-4 grid grid-cols-7" role="group" aria-label={monthLabel(month)}>
              {Array.from({ length: mondayFirstBlanks }).map((_, index) => (
                <div
                  key={`lead-${index}`}
                  aria-hidden
                  className="flex h-11 items-center justify-center"
                >
                  <span className="flex h-10 w-10 items-center justify-center text-[15px] leading-none text-[color:var(--ios-ink2)] opacity-40">
                    {previousMonthDays - mondayFirstBlanks + index + 1}
                  </span>
                </div>
              ))}

              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1;
                const key = dayKey(month, day);
                const count = counts[key] ?? 0;
                const isToday = key === todayKey;
                const isSelected = selected === day;
                const logText = count > 0 ? ` — ${count} log${count === 1 ? "" : "s"}` : "";

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    aria-pressed={isSelected}
                    aria-label={`${longDayLabel(month, day)}${logText}`}
                    className="flex h-11 items-center justify-center"
                  >
                    <span
                      className={`flex h-10 w-10 flex-col items-center justify-center rounded-full text-[15px] leading-none tabular-nums ${
                        isSelected
                          ? `bg-[color:var(--ios-accent)] font-semibold text-[#111]${
                              isToday ? " ring-[1.5px] ring-[color:var(--ios-ink)]" : ""
                            }`
                          : isToday
                            ? "font-semibold ring-[1.5px] ring-[color:var(--ios-ink)]"
                            : "text-[color:var(--ios-ink)]"
                      }`}
                    >
                      {day}
                      {count > 0 && !isSelected ? (
                        <span
                          aria-hidden
                          className="mt-[2px] h-1.5 w-1.5 rounded-full bg-[color:var(--ios-accent)]"
                        />
                      ) : null}
                    </span>
                  </button>
                );
              })}

              {Array.from({ length: trailingDays }).map((_, index) => (
                <div
                  key={`trail-${index}`}
                  aria-hidden
                  className="flex h-11 items-center justify-center"
                >
                  <span className="flex h-10 w-10 items-center justify-center text-[15px] leading-none text-[color:var(--ios-ink2)] opacity-40">
                    {index + 1}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {!isLoading && !error && selected !== null && selectedKey ? (
          <Section title={longDayLabel(month, selected)} icon="calendar">
            {selectedCount > 0 ? (
              <Row
                href={`/worklogs?project=${projectId}&from=${selectedKey}&to=${selectedKey}`}
                chevron
                title={`${selectedCount} log${selectedCount === 1 ? "" : "s"} on file`}
                subtitle="Open this day in Logs"
              />
            ) : (
              <Row
                title="No logs on this day"
                subtitle="Pick a day with a dot, or add today's log."
              />
            )}
          </Section>
        ) : !isLoading && !error ? (
          <p className="t-footnote t-secondary mt-5 px-4">Pick a day to see its logs.</p>
        ) : null}

        <Sheet open={sitePickerOpen} onOpenChange={setSitePickerOpen} title="Site">
          <div className="overflow-hidden rounded-[10px] bg-[color:var(--ios-card)] ios-hairline">
            {projects.map((project) => (
              <Row
                key={project._id}
                onClick={() => {
                  setSitePickerOpen(false);
                  if (project._id !== projectId) {
                    router.push(`/projects/${project._id}/calendar`);
                  }
                }}
                title={project.name}
                trailing={
                  project._id === projectId ? (
                    <Check className="h-4 w-4 text-[color:var(--ios-tint)]" aria-hidden />
                  ) : undefined
                }
              />
            ))}
            {projects.length === 0 && (
              <Row title="No sites on file" subtitle="Sites appear here once they are created." />
            )}
          </div>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="animate-fade-up mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold uppercase">
          Calendar{projectName ? <span className="text-muted-foreground"> — {projectName}</span> : null}
        </h1>
        <div className="w-full sm:w-64">
          <Select
            value={projectId}
            onValueChange={(value) => router.push(`/projects/${value}/calendar`)}
          >
            <SelectTrigger aria-label="Select project">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project._id} value={project._id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="animate-fade-up" style={{ animationDelay: "60ms" }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-lg uppercase tabular-nums">{monthLabel(month)}</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonth(shiftMonth(month, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {error && <p className="py-6 text-center text-destructive">{error}</p>}

          {!error && isLoading && <Skeleton className="h-80 w-full" />}

          {!error && !isLoading && (
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="py-1 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {label}
                </div>
              ))}

              {Array.from({ length: leadingBlanks }, (_, index) => (
                <div key={`blank-${index}`} />
              ))}

              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const key = dayKey(month, day);
                const count = counts[key] ?? 0;
                const isToday = key === todayKey;
                const cellClasses = `flex min-h-[4rem] flex-col items-start gap-1 rounded-md border p-1.5 sm:p-2 ${
                  isToday ? "border-primary" : "border-border"
                }`;

                if (count === 0) {
                  return (
                    <div key={key} className={cellClasses}>
                      <span className="text-sm tabular-nums text-muted-foreground">{day}</span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={key}
                    href={`/worklogs?project=${projectId}&from=${key}&to=${key}`}
                    className={`${cellClasses} bg-accent/40 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                    aria-label={`${count} worklog${count === 1 ? "" : "s"} on ${key}`}
                  >
                    <span className="text-sm font-semibold tabular-nums">{day}</span>
                    <span className="inline-flex items-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold tabular-nums text-primary-foreground">
                      {count}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
