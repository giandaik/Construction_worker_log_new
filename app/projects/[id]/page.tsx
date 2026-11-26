'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, History, PlusCircle, Pencil, MapPin } from 'lucide-react';
import { DwgUpload, type DwgFile } from '@/components/forms/DwgUpload';
import { ProjectMap } from '@/components/projects/ProjectMap';
import { ProjectCatalogManager } from '@/components/projects/ProjectCatalogManager';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { apiFetch } from '@/lib/apiClient';
import { isNativeBundle } from '@/lib/native-mode';
import { toGreekUpperCase } from '@/lib/utils';
import { useRouteId } from "@/lib/native-route";
import {
  Btn,
  Pill,
  Row,
  Section,
  Skeleton as NativeSkeleton,
} from '@/components/native/ui';

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planned',
  'in-progress': 'In progress',
  active: 'Active',
  completed: 'Completed',
  'on-hold': 'On hold',
};

function statusLabel(status?: string): string {
  if (!status) return 'No status';
  return STATUS_LABELS[status] ?? status;
}

function statusTone(status?: string): 'ok' | 'warn' | 'plan' | 'draft' {
  if (status === 'completed') return 'ok';
  if (status === 'in-progress' || status === 'active') return 'warn';
  if (status === 'planned') return 'plan';
  return 'draft';
}

/** "24PEP021 - IALONET" → code "24PEP021", name "IALONET". Names without a code stay whole. */
function splitCode(name: string): { code: string; name?: string } {
  const match = name.match(/^([0-9A-Za-z][0-9A-Za-z._/-]*)\s+[-–—]\s+(.+)$/);
  if (!match) return { code: name };
  return { code: match[1], name: match[2] };
}

function formatDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB');
}

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
  const id = useRouteId();

  const { user } = useCurrentUser();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The native shell resolves the id from `?id=` after mount; wait for it
    // instead of firing a request for `/api/projects/`.
    if (!id) return;
    const fetchProject = async () => {
      try {
        setIsLoading(true);
        const response = await apiFetch(`/api/projects/${id}`);
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
    if (isNativeBundle()) {
      return (
        <div className="pb-6">
          <NativeSkeleton rows={4} />
        </div>
      );
    }
    return (
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <Skeleton className="mb-4 h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !project) {
    if (isNativeBundle()) {
      return (
        <div className="px-4 pt-3">
          <div className="rounded-[10px] bg-[color:var(--ios-card)] px-4 py-8 text-center ios-hairline">
            <p className="t-footnote text-[#c0392b]">{error ?? 'Project not found'}</p>
          </div>
        </div>
      );
    }
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

  if (isNativeBundle()) {
    const { code, name } = splitCode(project.name);
    const hasDetails =
      !!project.description ||
      !!project.startDate ||
      !!project.endDate ||
      !!project.ownerEmail ||
      !!project.contractorEmail ||
      !!project.manager;

    return (
      <div className="pb-8">
        <div className="px-4 pb-1 pt-3">
          <h1 className="t-title2">{toGreekUpperCase(code)}</h1>
          {name ? <p className="t-body mt-0.5">{name}</p> : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {project.status ? (
              <Pill tone={statusTone(project.status)}>{statusLabel(project.status)}</Pill>
            ) : null}
            <span className="t-footnote flex min-w-0 items-center gap-1 text-[color:var(--ios-ink2)]">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{project.location ?? 'No location yet'}</span>
            </span>
          </div>
        </div>

        <div className="mx-4 mt-2 grid grid-cols-3 gap-2">
          <Btn variant="secondary" href={`/projects/${project._id}/calendar`}>
            Calendar
          </Btn>
          <Btn variant="secondary" href={`/worklogs?project=${project._id}`}>
            History
          </Btn>
          <Btn variant="primary" href={`/logs/new?project=${project._id}`}>
            New log
          </Btn>
        </div>

        <Section
          title="Logs"
          icon="logs"
          action={
            <Link
              href={`/worklogs?project=${project._id}`}
              className="t-footnote font-medium text-[color:var(--ios-tint)]"
            >
              Open in Logs
            </Link>
          }
        >
          <Row
            href={`/worklogs?project=${project._id}`}
            chevron
            title="All logs for this site"
            subtitle="Every log recorded for this site, newest first."
          />
        </Section>

        {hasDetails && (
          <Section
            title="Details"
            icon="doc"
            action={
              canManageDwgs ? (
                <Link
                  href={`/projects/${project._id}/edit`}
                  className="t-footnote font-medium text-[color:var(--ios-tint)]"
                >
                  Edit
                </Link>
              ) : undefined
            }
          >
            {project.description && (
              <Row title="Description" subtitle={project.description} />
            )}
            {project.startDate && <Row title="Start" value={formatDate(project.startDate)} />}
            {project.endDate && <Row title="End" value={formatDate(project.endDate)} />}
            {project.manager && (
              <Row
                title="Manager"
                // The list endpoint returns a raw ObjectId; show a dash rather
                // than 24 hex characters where a person's name belongs.
                value={/^[a-f0-9]{24}$/i.test(String(project.manager)) ? '—' : project.manager}
              />
            )}
            {project.ownerEmail && <Row title="Owner" value={project.ownerEmail} />}
            {project.contractorEmail && <Row title="Contractor" value={project.contractorEmail} />}
          </Section>
        )}

        {project.latitude != null && project.longitude != null && (
          <div className="mx-4 mt-4 overflow-hidden rounded-[10px]">
            <ProjectMap latitude={project.latitude} longitude={project.longitude} />
          </div>
        )}

        <Section title="Drawings" icon="pen">
          <div className="p-4">
            <DwgUpload
              projectId={project._id}
              value={project.dwgFiles ?? []}
              onChange={handleDwgChange}
              readOnly={!canManageDwgs}
            />
          </div>
        </Section>

        {canManageDwgs && (
          <Section title="Κατάλογος Επιλογών" icon="sliders">
            <div className="p-4">
              <ProjectCatalogManager
                projectId={project._id}
                initial={{
                  personnelRoles: project.personnelRoles ?? [],
                  equipmentTypes: project.equipmentTypes ?? [],
                  materialNames: project.materialNames ?? [],
                  materialUnits: project.materialUnits ?? [],
                }}
              />
            </div>
          </Section>
        )}
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
