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
import { ArrowLeft, ChevronRight, Plus } from "lucide-react";
import { FORM_STATUS_LABELS, FORM_STATUS_CLASSES } from "@/lib/constants/constantValues";

const ALL_PROJECTS = "all";

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


function WorkLogsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get('project') || '';
  const fromParam = searchParams.get('from') || '';
  const toParam = searchParams.get('to') || '';
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [filterProjectId, setFilterProjectId] = useState<string>(projectIdParam);
  const [fromDate, setFromDate] = useState<string>(fromParam);
  const [toDate, setToDate] = useState<string>(toParam);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkLogs = async () => {
      try {
        setIsLoading(true);
        const url = filterProjectId ? `/api/worklogs?project=${filterProjectId}` : '/api/worklogs';
        const [workLogsResponse, projectsResponse] = await Promise.all([
          fetch(url),
          fetch('/api/projects')
        ]);

        if (!workLogsResponse.ok) {
          throw new Error('Failed to fetch work logs');
        }

        if (!projectsResponse.ok) {
          throw new Error('Failed to fetch projects');
        }

        const workLogsData = await workLogsResponse.json();
        const projectsData = await projectsResponse.json();

        setWorkLogs(workLogsData);
        setProjects(projectsData);

        if (filterProjectId) {
          const foundProject = projectsData.find((p: Project) => p._id === filterProjectId);
          setProject(foundProject || null);
        } else {
          setProject(null);
        }
      } catch (error) {
        console.error('Error fetching work logs:', error);
        setError('Failed to load work logs');
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

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.push('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Button>
        </div>
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
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
        </Button>
      </div>
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
          <Link href="/forms/new">
            <Plus className="mr-2 h-4 w-4" /> Create New
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
            <Link href="/forms/new">
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
        <div className="mb-6">
          <Button variant="ghost" disabled>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Button>
        </div>
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
