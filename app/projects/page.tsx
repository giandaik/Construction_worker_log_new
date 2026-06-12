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
import { ArrowLeft, CalendarDays, History, MapPin, PlusCircle, Search, UserRound } from "lucide-react";
import { toGreekUpperCase } from "@/lib/utils";

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

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES);
  const [sortKey, setSortKey] = useState<SortKey>("activity");

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/projects');

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

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.push('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Button>
        </div>
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

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
        </Button>
      </div>
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
                    <Link href={`/forms/new?project=${project._id}`}>
                      <PlusCircle className="w-4 h-4 mr-2" />
                      New Form
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
