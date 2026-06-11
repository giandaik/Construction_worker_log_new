// app/projects/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, History, PlusCircle } from "lucide-react";

interface Project {
  _id: string;
  name: string;
  description?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  manager?: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="animate-fade-up flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold uppercase">
          Projects <span className="text-muted-foreground">({projects.length})</span>
        </h1>
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

      {!error && projects.length > 0 && (
        <div className="animate-fade-up grid gap-4 md:grid-cols-2" style={{ animationDelay: '60ms' }}>
          {projects.map((project) => (
            <Card key={project._id} className="relative flex flex-col transition-shadow hover:shadow-md">
              <Link
                href={`/projects/${project._id}`}
                className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`View ${project.name}`}
              />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-xl uppercase">{project.name}</CardTitle>
                  {project.status && (
                    <span className="status-badge status-unknown shrink-0">{project.status}</span>
                  )}
                </div>
                {project.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
                )}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-end gap-4">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {project.location && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</dt>
                      <dd>{project.location}</dd>
                    </div>
                  )}
                  {project.manager && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Manager</dt>
                      <dd>{project.manager}</dd>
                    </div>
                  )}
                  {project.startDate && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Start</dt>
                      <dd className="tabular-nums">{new Date(project.startDate).toLocaleDateString()}</dd>
                    </div>
                  )}
                  {project.endDate && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">End</dt>
                      <dd className="tabular-nums">{new Date(project.endDate).toLocaleDateString()}</dd>
                    </div>
                  )}
                </dl>
                <div className="relative z-10 flex flex-wrap gap-2">
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

