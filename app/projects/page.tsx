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
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
        </Button>
      </div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
      </div>

      {error && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-red-500">{error}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && projects.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-gray-500">No projects found</p>
          </CardContent>
        </Card>
      )}

      {!error && projects.length > 0 && (
        <div className="grid gap-4">
          {projects.map((project) => (
            <Card key={project._id}>
              <CardHeader>
                <CardTitle>{project.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {project.description && (
                  <p className="mb-2"><strong>Description:</strong> {project.description}</p>
                )}
                {project.location && (
                  <p className="mb-2"><strong>Location:</strong> {project.location}</p>
                )}
                {project.status && (
                  <p className="mb-2"><strong>Status:</strong> {project.status}</p>
                )}
                {project.startDate && (
                  <p className="mb-2"><strong>Start Date:</strong> {new Date(project.startDate).toLocaleDateString()}</p>
                )}
                {project.endDate && (
                  <p className="mb-2"><strong>End Date:</strong> {new Date(project.endDate).toLocaleDateString()}</p>
                )}
                {project.manager && (
                  <p className="mb-2"><strong>Manager:</strong> {project.manager}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/worklogs?project=${project._id}`}>
                    <Button variant="outline" size="sm">
                      <History className="w-4 h-4 mr-2" />
                      History
                    </Button>
                  </Link>
                  <Link href={`/forms/new?project=${project._id}`}>
                    <Button size="sm">
                      <PlusCircle className="w-4 h-4 mr-2" />
                      New Form
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

