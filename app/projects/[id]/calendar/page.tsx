// app/projects/[id]/calendar/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

interface ProjectSummary {
  _id: string;
  name: string;
}

interface DayCount {
  date: string;
  count: number;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

export default function ProjectCalendarPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [month, setMonth] = useState<string>(currentMonth());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch("/api/projects");
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
    const fetchCounts = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(
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

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push(`/projects/${projectId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Project
        </Button>
      </div>

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
