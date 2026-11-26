// app/projects/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, History, MapPin, PlusCircle, Search, UserRound } from "lucide-react";
import { Glyph } from "@/components/native/icons";
import { toGreekUpperCase } from "@/lib/utils";
import { apiFetch } from "@/lib/apiClient";
import { isNativeBundle } from "@/lib/native-mode";
import {
  Btn,
  LargeTitle,
  Pill,
  Empty,
  Row,
  Section,
  Skeleton as NativeSkeleton,
} from "@/components/native/ui";
import { SearchField, Segmented } from "@/components/native/controls";

interface Project {
  _id: string;
  name: string;
  description?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  manager?: string;
  worklogCount: number;
  lastLogDate: string | null;
}

const ALL_STATUSES = "all";

type SortKey = "activity" | "name" | "logs";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "activity", label: "Last activity" },
  { value: "name", label: "Name" },
  { value: "logs", label: "Log count" },
];

function compareProjects(a: Project, b: Project, sortKey: SortKey): number {
  if (sortKey === "name") {
    return a.name.localeCompare(b.name);
  }
  if (sortKey === "logs") {
    return b.worklogCount - a.worklogCount;
  }
  // Last activity, most recent first; projects without logs go last
  if (!a.lastLogDate && !b.lastLogDate) return a.name.localeCompare(b.name);
  if (!a.lastLogDate) return 1;
  if (!b.lastLogDate) return -1;
  return b.lastLogDate.localeCompare(a.lastLogDate);
}

/* ---------- Native presentation helpers (Capacitor bundle only) ---------- */

type NativeFilter = "all" | "active" | "planned";

const NATIVE_FILTERS: { value: NativeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "planned", label: "Planned" },
];

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  "in-progress": "In progress",
  active: "Active",
  completed: "Completed",
  "on-hold": "On hold",
};

function statusLabel(status?: string): string {
  if (!status) return "No status";
  return STATUS_LABELS[status] ?? status;
}

function statusTone(status?: string): "ok" | "warn" | "plan" | "draft" {
  switch (status) {
    case "completed":
      return "ok";
    case "in-progress":
    case "active":
      return "warn";
    case "planned":
      return "plan";
    default:
      return "draft";
  }
}

/** "24PEP021 - IALONET" → code "24PEP021", name "IALONET". Names without a code stay whole. */
function splitCode(name: string): { code: string; name?: string } {
  const match = name.match(/^([0-9A-Za-z][0-9A-Za-z._/-]*)\s+[-–—]\s+(.+)$/);
  if (!match) return { code: name };
  return { code: match[1], name: match[2] };
}

function logMeta(project: Project): string {
  if (!project.worklogCount) return "No logs yet";
  const count = `${project.worklogCount} log${project.worklogCount === 1 ? "" : "s"}`;
  if (!project.lastLogDate) return count;
  return `${count} · last ${new Date(project.lastLogDate).toLocaleDateString("en-GB")}`;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES);
  const [sortKey, setSortKey] = useState<SortKey>("activity");
  const [nativeFilter, setNativeFilter] = useState<NativeFilter>("all");

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        const response = await apiFetch('/api/projects');

        if (!response.ok) {
          throw new Error('Failed to fetch projects');
        }

        const data = await response.json();
        setProjects(data);
      } catch (error) {
        console.error('Error fetching projects:', error);
        setError('Failed to load projects');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const statusOptions = useMemo(() => {
    const statuses = new Set(
      projects.map((project) => project.status).filter((status): status is string => !!status)
    );
    return Array.from(statuses).sort();
  }, [projects]);

  const visibleProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return projects
      .filter((project) => {
        if (statusFilter !== ALL_STATUSES && project.status !== statusFilter) {
          return false;
        }
        if (!term) return true;
        return (
          project.name.toLowerCase().includes(term) ||
          (project.location ?? "").toLowerCase().includes(term)
        );
      })
      .sort((a, b) => compareProjects(a, b, sortKey));
  }, [projects, searchTerm, statusFilter, sortKey]);

  const nativeProjects = useMemo(() => {
    if (nativeFilter === "planned") {
      return visibleProjects.filter((project) => project.status === "planned");
    }
    if (nativeFilter === "active") {
      return visibleProjects.filter(
        (project) => project.status === "in-progress" || project.status === "active"
      );
    }
    return visibleProjects;
  }, [visibleProjects, nativeFilter]);

  /** Grouped cards, ordered the way the design board groups sites. */
  const nativeGroups = useMemo(() => {
    const order = ["in-progress", "active", "planned", "completed", "on-hold"];
    const groups = new Map<string, Project[]>();
    nativeProjects.forEach((project) => {
      const key = project.status ?? "";
      groups.set(key, [...(groups.get(key) ?? []), project]);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
    });
  }, [nativeProjects]);

  const totalLogs = useMemo(
    () => projects.reduce((sum, project) => sum + (project.worklogCount || 0), 0),
    [projects]
  );

  if (isLoading) {
    if (isNativeBundle()) {
      return (
        <div className="pb-6">
          <LargeTitle>Sites</LargeTitle>
          <NativeSkeleton rows={6} />
        </div>
      );
    }
    return (
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Projects</h1>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (isNativeBundle()) {
    const siteCount = `${projects.length} site${projects.length === 1 ? "" : "s"}`;
    const logCount = `${totalLogs} log${totalLogs === 1 ? "" : "s"}`;
    const nothingVisible = !error && nativeProjects.length === 0;

    return (
      <div className="pb-6">
        <LargeTitle sub={`${siteCount} · ${logCount}`}>Sites</LargeTitle>

        <SearchField value={searchTerm} onChange={setSearchTerm} placeholder="Search sites" />
        <Segmented options={NATIVE_FILTERS} value={nativeFilter} onChange={setNativeFilter} />

        {error && (
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
        )}

        {nothingVisible && (
          <Section>
            <Empty
              icon="sites"
              title={projects.length === 0 ? "No sites on file" : "No sites match"}
              text={
                projects.length === 0
                  ? "Sites appear here once they are created."
                  : "Try another search or filter."
              }
            >
              {projects.length > 0 && (
                <Btn
                  variant="secondary"
                  onClick={() => {
                    setSearchTerm("");
                    setNativeFilter("all");
                  }}
                >
                  Clear filters
                </Btn>
              )}
            </Empty>
          </Section>
        )}

        {nativeGroups.map(([status, group]) => (
          <Section
            key={status || "none"}
            title={`${statusLabel(status || undefined)} · ${group.length}`}
            icon="sites"
          >
            {group.map((project) => {
              const { code, name } = splitCode(project.name);
              return (
                <Row
                  key={project._id}
                  href={`/projects/${project._id}`}
                  chevron
                  trailing={<Pill tone={statusTone(project.status)}>{statusLabel(project.status)}</Pill>}
                >
                  <div className="t-body truncate font-semibold leading-[22px]">{toGreekUpperCase(code)}</div>
                  {name ? (
                    <div className="t-subhead truncate leading-[20px] text-[color:var(--ios-ink2)]">{name}</div>
                  ) : null}
                  <div className="t-footnote mt-0.5 flex min-w-0 items-center gap-1 text-[color:var(--ios-ink2)]">
                    {project.location ? (
                      <>
                        <Glyph name="pin" size={13} className="shrink-0" />
                        <span className="truncate">{project.location}</span>
                        <span aria-hidden>·</span>
                      </>
                    ) : null}
                    <span className="shrink-0">{logMeta(project)}</span>
                  </div>
                </Row>
              );
            })}
          </Section>
        ))}

        {!error && projects.length > 0 ? (
          <p className="t-footnote t-secondary mt-4 px-4">
            {siteCount} on file. Archived sites stay readable from the office.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="animate-fade-up flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold uppercase">
          Projects <span className="text-muted-foreground">({visibleProjects.length})</span>
        </h1>
      </div>

      <div className="animate-fade-up mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: '30ms' }}>
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            className="pl-9"
            placeholder="Search by name or location"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search projects"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
          <SelectTrigger aria-label="Sort projects">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                Sort: {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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

      {!error && projects.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">No projects found</p>
          </CardContent>
        </Card>
      )}

      {!error && projects.length > 0 && visibleProjects.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">No projects match the current filters.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter(ALL_STATUSES);
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && visibleProjects.length > 0 && (
        <div className="animate-fade-up grid gap-4 sm:grid-cols-2 lg:grid-cols-3" style={{ animationDelay: '60ms' }}>
          {visibleProjects.map((project) => (
            <Card key={project._id} className="relative flex flex-col transition-shadow hover:shadow-md">
              <Link
                href={`/projects/${project._id}`}
                className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`View ${project.name}`}
              />
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-lg uppercase">{toGreekUpperCase(project.name)}</CardTitle>
                  {project.status && (
                    <span className="status-badge status-unknown shrink-0">{project.status}</span>
                  )}
                </div>
                {(project.location || project.manager) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {project.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" aria-hidden /> {project.location}
                      </span>
                    )}
                    {project.manager && (
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="h-3.5 w-3.5" aria-hidden /> {project.manager}
                      </span>
                    )}
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-end gap-3 pt-0">
                <dl className="grid grid-cols-2 gap-x-4 text-sm">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Logs</dt>
                    <dd className="tabular-nums font-semibold">{project.worklogCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last log</dt>
                    <dd className="tabular-nums">
                      {project.lastLogDate ? new Date(project.lastLogDate).toLocaleDateString('en-US') : '—'}
                    </dd>
                  </div>
                </dl>
                <div className="relative z-10 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/projects/${project._id}/calendar`}>
                      <CalendarDays className="w-4 h-4 mr-2" />
                      Calendar
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/worklogs?project=${project._id}`}>
                      <History className="w-4 h-4 mr-2" />
                      History
                    </Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link href={`/logs/new?project=${project._id}`}>
                      <PlusCircle className="w-4 h-4 mr-2" />
                      New log
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
