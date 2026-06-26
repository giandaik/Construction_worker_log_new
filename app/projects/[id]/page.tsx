'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, History, PlusCircle, Pencil } from 'lucide-react';
import { DwgUpload, type DwgFile } from '@/components/forms/DwgUpload';
import { ProjectMap } from '@/components/projects/ProjectMap';
import { ProjectCatalogManager } from '@/components/projects/ProjectCatalogManager';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface Project {
  _id: string;
  name: string;
  description?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  manager?: string;
  ownerEmail?: string;
  contractorEmail?: string;
  dwgFiles?: DwgFile[];
  personnelRoles?: string[];
  equipmentTypes?: string[];
  materialNames?: string[];
  materialUnits?: string[];
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { user } = useCurrentUser();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/projects/${id}`);
        if (!response.ok) throw new Error('Failed to fetch project');
        setProject(await response.json());
      } catch (e) {
        console.error(e);
        setError('Failed to load project');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProject();
  }, [id]);

  const handleDwgChange = useCallback((dwgFiles: DwgFile[]) => {
    setProject((prev) => (prev ? { ...prev, dwgFiles } : prev));
  }, []);

  const canManageDwgs = user?.role === 'admin' || user?.role === 'manager';

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <Skeleton className="mb-4 h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-destructive">{error ?? 'Project not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {canManageDwgs && (
            <Link href={`/projects/${project._id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
            </Link>
          )}
          <Link href={`/projects/${project._id}/calendar`}>
            <Button variant="outline" size="sm">
              <CalendarDays className="mr-2 h-4 w-4" /> Calendar
            </Button>
          </Link>
          <Link href={`/worklogs?project=${project._id}`}>
            <Button variant="outline" size="sm">
              <History className="mr-2 h-4 w-4" /> History
            </Button>
          </Link>
          <Link href={`/logs/new?project=${project._id}`}>
            <Button size="sm">
              <PlusCircle className="mr-2 h-4 w-4" /> New log
            </Button>
          </Link>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{project.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {project.description && <p><strong>Description:</strong> {project.description}</p>}
          {project.location && <p><strong>Location:</strong> {project.location}</p>}
          {project.latitude != null && project.longitude != null && (
            <div className="pt-2">
              <ProjectMap latitude={project.latitude} longitude={project.longitude} />
            </div>
          )}
          {project.status && <p><strong>Status:</strong> {project.status}</p>}
          {project.startDate && (
            <p><strong>Start:</strong> {new Date(project.startDate).toLocaleDateString()}</p>
          )}
          {project.endDate && (
            <p><strong>End:</strong> {new Date(project.endDate).toLocaleDateString()}</p>
          )}
          {project.ownerEmail && <p><strong>Owner:</strong> {project.ownerEmail}</p>}
          {project.contractorEmail && <p><strong>Contractor:</strong> {project.contractorEmail}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Drawings</CardTitle>
        </CardHeader>
        <CardContent>
          <DwgUpload
            projectId={project._id}
            value={project.dwgFiles ?? []}
            onChange={handleDwgChange}
            readOnly={!canManageDwgs}
          />
        </CardContent>
      </Card>

      {canManageDwgs && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Κατάλογος Επιλογών</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectCatalogManager
              projectId={project._id}
              initial={{
                personnelRoles: project.personnelRoles ?? [],
                equipmentTypes: project.equipmentTypes ?? [],
                materialNames: project.materialNames ?? [],
                materialUnits: project.materialUnits ?? [],
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
