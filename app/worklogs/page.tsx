// app/worklogs/page.tsx
"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Plus } from "lucide-react";
import { FORM_STATUS, FORM_STATUS_LABELS, FORM_STATUS_CLASSES } from "@/lib/constants/constantValues";
import { fetchJsonCached } from "@/lib/cachedApi";
import { peekCached } from "@/lib/apiCache";
import { isNativeBundle } from "@/lib/native-mode";
import { useSplitPane } from "@/hooks/useSplitPane";
import { WorkLogDetail } from "@/components/worklogs/WorkLogDetail";
import {
  Btn,
  Empty,
  LargeTitle,
  Pill,
  Row,
  Section,
  Skeleton as NativeSkeleton,
} from "@/components/native/ui";
import { SearchField, Segmented } from "@/components/native/controls";
import { OfflineBar } from "@/components/native/OfflineBar";

const ALL_PROJECTS = "all";

/* ---------- Native (Capacitor) presentation helpers ---------- */

type NativePeriod = "month" | "recent" | "all";

const NATIVE_PERIODS: { value: NativePeriod; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "recent", label: "30 days" },
  { value: "all", label: "All" },
];

/** The glyph a period's header carries: a month, a rolling window, everything. */
function periodIcon(period: NativePeriod): "calendar" | "clock" | "logs" {
  if (period === "month") return "calendar";
  if (period === "recent") return "clock";
  return "logs";
}

/** dd/mm/yyyy, the form the site diary uses. */
function logDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Short Greek label for the pill — the full signed label does not fit a 390 pt row. */
function nativeStatusLabel(status?: string): string {
  if (status === FORM_STATUS.SIGNED) return "Αναμονή";
  return FORM_STATUS_LABELS[status as keyof typeof FORM_STATUS_LABELS] ?? "N/A";
}

function nativeStatusTone(status?: string): "ok" | "warn" | "plan" | "draft" {
  if (status === FORM_STATUS.COMPLETED) return "ok";
  if (status === FORM_STATUS.SIGNED) return "warn";
  if (status === FORM_STATUS.PENDING) return "draft";
  return "draft";
}

interface WorkLog {
  _id: string;
  date: string;
  project: string;
  author: string;
  workDescription: string;
  status: string;
}

interface Project {
  _id: string;
  name: string;
}


/* ---------- Cache keys ---------- */

/** Per-project list, so switching the filter paints the list it already has. */
function workLogCacheKey(projectId: string): string {
  return `worklogs:${projectId || "all"}`;
}

const PROJECTS_CACHE_KEY = "projects";

/** Projects change rarely; a prefetch inside this window issues no request. */
const PROJECTS_MAX_AGE_MS = 5 * 60_000;

function WorkLogsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get('project') || '';
  const fromParam = searchParams.get('from') || '';
  const toParam = searchParams.get('to') || '';
  // Seeded from the cache in the initialisers: a returning visit renders its
  // rows on the first paint instead of a full-page skeleton. The fetch below
  // still runs and replaces them, so the list is never stale for long.
  const [workLogs, setWorkLogs] = useState<WorkLog[]>(
    () => peekCached<WorkLog[]>(workLogCacheKey(projectIdParam)) ?? []
  );
  const [projects, setProjects] = useState<Project[]>(
    () => peekCached<Project[]>(PROJECTS_CACHE_KEY) ?? []
  );
  const [project, setProject] = useState<Project | null>(null);
  const [filterProjectId, setFilterProjectId] = useState<string>(projectIdParam);
  const [fromDate, setFromDate] = useState<string>(fromParam);
  const [toDate, setToDate] = useState<string>(toParam);
  const [isLoading, setIsLoading] = useState(
    () => peekCached<WorkLog[]>(workLogCacheKey(projectIdParam)) === null
  );
  const [error, setError] = useState<string | null>(null);
  // Native-only, presentation state: the search field and period segment narrow
  // the rows that were already fetched. No URL, query or API involvement.
  const [nativeQuery, setNativeQuery] = useState("");
  const [nativePeriod, setNativePeriod] = useState<NativePeriod>(
    projectIdParam || fromParam || toParam ? "all" : "month"
  );
  // Tablet master–detail: which log is open in the right-hand pane. `split`
  // starts false and flips after mount, so the phone render is the default.
  const split = useSplitPane();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkLogs = async () => {
      const cacheKey = workLogCacheKey(filterProjectId);
      const cached = peekCached<WorkLog[]>(cacheKey);

      // Warm cache: paint it now, refresh behind the user's back. Cold cache:
      // this is the only path that shows the skeleton.
      if (cached) {
        setWorkLogs(cached);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }

      try {
        const url = filterProjectId ? `/api/worklogs?project=${filterProjectId}` : '/api/worklogs';
        // Cached and de-duplicated: a prefetch from the tab bar usually means
        // this resolves without a request at all.
        const [workLogsData, projectsData] = await Promise.all([
          fetchJsonCached<WorkLog[]>(cacheKey, url),
          fetchJsonCached<Project[]>(PROJECTS_CACHE_KEY, '/api/projects'),
        ]);

        setWorkLogs(workLogsData);
        setProjects(projectsData);
        setError(null);

        if (filterProjectId) {
          const foundProject = projectsData.find((p: Project) => p._id === filterProjectId);
          setProject(foundProject || null);
        } else {
          setProject(null);
        }
      } catch (error) {
        console.error('Error fetching work logs:', error);
        // A cached list is better than an error screen: only report failure
        // when there is nothing to show.
        if (!cached) setError('Failed to load work logs');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkLogs();
  }, [filterProjectId]);

  // Keep local filter state in sync with URL query params
  useEffect(() => {
    setFilterProjectId(projectIdParam);
    setFromDate(fromParam);
    setToDate(toParam);
  }, [projectIdParam, fromParam, toParam]);

  const projectNameMap = useMemo(() => {
    return projects.reduce<Record<string, string>>((acc, proj) => {
      acc[proj._id] = proj.name;
      return acc;
    }, {});
  }, [projects]);

  const getProjectName = (projectValue: string) => {
    if (!projectValue) return 'Unknown project';
    return projectNameMap[projectValue] || 'Unknown project';
  };

  const hasFilters = !!(filterProjectId || fromDate || toDate);

  const filteredLogs = useMemo(() => {
    if (!hasFilters) {
      return workLogs;
    }

    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;
    if (to) {
      to.setHours(23, 59, 59, 999);
    }

    return workLogs.filter((log) => {
      const logDate = log.date ? new Date(log.date) : null;

      if (from && (!logDate || logDate < from)) {
        return false;
      }

      if (to && (!logDate || logDate > to)) {
        return false;
      }

      if (filterProjectId && log.project !== filterProjectId) {
        return false;
      }

      return true;
    });
  }, [workLogs, filterProjectId, fromDate, toDate, hasFilters]);

  /**
   * Native list = the rows the page already resolved (project + URL date range),
   * narrowed further by the period segment and the search field. Client-side
   * only, so `?project=` keeps working exactly as it does on the web.
   */
  const nativeLogs = useMemo(() => {
    let from: Date | null = null;
    if (nativePeriod === "month") {
      const now = new Date();
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (nativePeriod === "recent") {
      const now = new Date();
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    }

    const query = nativeQuery.trim().toLowerCase();

    return filteredLogs.filter((log) => {
      if (from) {
        const entryDate = log.date ? new Date(log.date) : null;
        if (!entryDate || entryDate < from) return false;
      }
      if (query) {
        const haystack = [
          projectNameMap[log.project] ?? "",
          log.workDescription ?? "",
          logDate(log.date),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [filteredLogs, nativePeriod, nativeQuery, projectNameMap]);

  const handleApplyFilters = () => {
    const params = new URLSearchParams();
    if (filterProjectId) params.set('project', filterProjectId);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);

    const query = params.toString();
    router.push(query ? `/worklogs?${query}` : '/worklogs');
  };

  const handleClearFilters = () => {
    setFilterProjectId('');
    setFromDate('');
    setToDate('');
    router.push('/worklogs');
  };

  // Master–detail default: the newest log is open when the pane appears, and a
  // selection that no longer exists (period change, filter) falls back to it.
  useEffect(() => {
    if (!split) return;
    if (selectedId && nativeLogs.some((log) => log._id === selectedId)) return;
    setSelectedId(nativeLogs[0]?._id ?? null);
  }, [split, nativeLogs, selectedId]);

  /* ------------------------------------------------------------------ *
   * Native presentation (Capacitor WebView). Same data, same handlers;
   * only the chrome and the grouping change. The web branch below is the
   * unchanged responsive page.
   * ------------------------------------------------------------------ */
  if (isNativeBundle()) {
    if (isLoading) {
      return (
        <div className="pb-4">
          <LargeTitle>Logs</LargeTitle>
          <NativeSkeleton rows={5} />
        </div>
      );
    }

    if (error) {
      return (
        <div className="pb-4">
          <LargeTitle>Logs</LargeTitle>
          <Section title="Could not load logs" icon="cloudOff">
            <div className="px-4 py-8 text-center">
              <p className="t-subhead t-secondary">{error}</p>
              <div className="mt-4 flex justify-center">
                <Btn variant="secondary" onClick={() => window.location.reload()}>
                  Retry
                </Btn>
              </div>
            </div>
          </Section>
        </div>
      );
    }

    const activeProjectName = filterProjectId ? project?.name ?? getProjectName(filterProjectId) : "";
    const periodTitle =
      nativePeriod === "month"
        ? new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })
        : nativePeriod === "recent"
          ? "Last 30 days"
          : "All logs";

    /**
     * The design groups the list by month ("November 2026") whenever the period
     * spans more than one — a field user scans for a date, not for a week number.
     * The month period already is one group, so it keeps its single header.
     */
    const monthGroups = (() => {
      const groups = new Map<string, typeof nativeLogs>();
      for (const log of nativeLogs) {
        const label = log.date
          ? new Date(log.date).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
          : "Undated";
        const list = groups.get(label) ?? [];
        list.push(log);
        groups.set(label, list);
      }
      return Array.from(groups.entries());
    })();

    const renderLogRow = (log: (typeof nativeLogs)[number]) => (
      <Row
        key={log._id}
        // In the split the row selects the record; on the phone it navigates.
        href={split ? undefined : `/worklogs/${log._id}`}
        onClick={split ? () => setSelectedId(log._id) : undefined}
        selected={split && log._id === selectedId}
        title={<span className="font-semibold">{getProjectName(log.project)}</span>}
        subtitle={
          <span className="block truncate text-[15px] leading-5">
            {log.workDescription || "No description"}
          </span>
        }
        trailing={
          <span className="flex shrink-0 flex-col items-end gap-1">
            <Pill tone={nativeStatusTone(log.status)}>{nativeStatusLabel(log.status)}</Pill>
            <span className="t-footnote tabular-nums text-[color:var(--ios-ink2)]">
              {logDate(log.date)}
            </span>
          </span>
        }
        chevron
      />
    );

    const listBody = (
      <>
        <LargeTitle
          sub={`${nativeLogs.length} ${nativeLogs.length === 1 ? "log" : "logs"}${
            activeProjectName ? ` · ${activeProjectName}` : ` · ${projects.length} sites`
          }`}
        >
          Logs
        </LargeTitle>

        <OfflineBar>
          No signal. The list shows what is on this phone; logs written now upload when you
          reconnect.
        </OfflineBar>

        <SearchField
          value={nativeQuery}
          onChange={setNativeQuery}
          placeholder="Site, work or date"
        />

        <Segmented options={NATIVE_PERIODS} value={nativePeriod} onChange={setNativePeriod} />

        {nativeLogs.length === 0 ? (
          <Section title={periodTitle} icon={periodIcon(nativePeriod)}>
            <Empty
              icon="doc"
              title="No logs in this period"
              text="Nothing was recorded for this filter. Widen the period, or start today's log."
            >
              <Btn variant="secondary" href="/logs/new">
                Start today&apos;s log
              </Btn>
            </Empty>
          </Section>
        ) : nativePeriod === "month" ? (
          <Section
            title={periodTitle}
            icon={periodIcon(nativePeriod)}
            footer={`${nativeLogs.length} of ${filteredLogs.length} logs shown`}
            action={
              filterProjectId ? (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="ios-tap -my-2 flex items-center text-[15px] font-semibold text-[color:var(--ios-tint)]"
                >
                  All sites
                </button>
              ) : undefined
            }
          >
            {nativeLogs.map(renderLogRow)}
          </Section>
        ) : (
          monthGroups.map(([label, group]) => (
            <Section key={label} title={label} icon="calendar">
              {group.map(renderLogRow)}
            </Section>
          ))
        )}
      </>
    );

    // Tablet: list on the left, the open record on the right. Both panes scroll
    // themselves (globals.css → .tb-split*). The phone keeps the plain column.
    if (split) {
      return (
        <div className="tb-split-page">
          <div className="tb-split">
            <div className="tb-split-list">{listBody}</div>
            {selectedId ? (
              <div className="tb-split-pane">
                <WorkLogDetail key={selectedId} id={selectedId} pane />
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    return <div className="pb-4">{listBody}</div>;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold uppercase">Work Logs</h1>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="animate-fade-up flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold uppercase">
            Work Logs <span className="text-muted-foreground">({filteredLogs.length})</span>
          </h1>
          {project && filterProjectId && (
            <p className="text-sm text-muted-foreground mt-1">
              Filtered by project: <strong>{project.name}</strong>
            </p>
          )}
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/logs/new">
            <Plus className="mr-2 h-4 w-4" /> New log
          </Link>
        </Button>
      </div>

      <Card className="animate-fade-up mb-6" style={{ animationDelay: '60ms' }}>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <label htmlFor="filter-from" className="block text-sm font-medium">
                From date
              </label>
              <Input
                id="filter-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="filter-to" className="block text-sm font-medium">
                To date
              </label>
              <Input
                id="filter-to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="filter-project" className="block text-sm font-medium">
                Project
              </label>
              <Select
                value={filterProjectId || ALL_PROJECTS}
                onValueChange={(value) =>
                  setFilterProjectId(value === ALL_PROJECTS ? '' : value)
                }
              >
                <SelectTrigger id="filter-project">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
                  {projects.map((proj) => (
                    <SelectItem key={proj._id} value={proj._id}>
                      {proj.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch md:items-end gap-2">
              <Button className="w-full" onClick={handleApplyFilters}>
                Apply Filters
              </Button>
              <Button variant="outline" className="w-full" onClick={handleClearFilters}>
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-destructive">{error}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && workLogs.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">
              {filterProjectId ? `No work logs found for this project` : 'No work logs found'}
            </p>
            {filterProjectId && (
              <Button
                variant="outline"
                onClick={() => router.push('/worklogs')}
                className="mt-4 mr-2"
              >
                View All Work Logs
              </Button>
            )}
            <Link href="/logs/new">
              <Button className="mt-4">Create Your First Work Log</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {!error && workLogs.length > 0 && filteredLogs.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">
              No work logs match the selected filters.
            </p>
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="mt-4 mr-2"
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && filteredLogs.length > 0 && (
        <ul className="animate-fade-up divide-y rounded-md border bg-card" style={{ animationDelay: '120ms' }}>
          {filteredLogs.map((log) => (
            <li key={log._id}>
              <Link
                href={`/worklogs/${log._id}`}
                className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="truncate font-display text-lg font-semibold">
                      {getProjectName(log.project)}
                    </p>
                    <span
                      className={`status-badge ${
                        FORM_STATUS_CLASSES[log.status as keyof typeof FORM_STATUS_CLASSES] ?? 'status-unknown'
                      }`}
                    >
                      {FORM_STATUS_LABELS[log.status as keyof typeof FORM_STATUS_LABELS] ?? 'N/A'}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {log.workDescription}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
                  <span className="text-sm tabular-nums">
                    {new Date(log.date).toLocaleDateString()}
                  </span>
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function WorkLogsPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold uppercase">Work Logs</h1>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    }>
      <WorkLogsPageContent />
    </Suspense>
  );
}
