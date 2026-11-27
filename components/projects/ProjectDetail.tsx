'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, History, PlusCircle, Pencil } from 'lucide-react';
import { LocationLink } from '@/components/LocationLink';
import { DwgUpload, type DwgFile } from '@/components/forms/DwgUpload';
import { ProjectMap } from '@/components/projects/ProjectMap';
import { ProjectCatalogManager } from '@/components/projects/ProjectCatalogManager';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { apiFetch } from '@/lib/apiClient';
import { isNativeBundle } from '@/lib/native-mode';
import { toGreekUpperCase } from '@/lib/utils';
import { OfflineBar } from '@/components/native/OfflineBar';
import {
  Btn,
  Empty,
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

interface SiteLog {
  _id: string;
  date: string;
  workDescription?: string;
  status?: string;
}

/**
 * One site, as a screen (`pane === false`, mounted by `/projects/[id]` and
 * `/projects/shell?id=…`) or as the right-hand pane of the tablet master–detail
 * (`pane === true`, mounted by the sites list). The pane only adds the wrapper
 * class that re-anchors the record's own fixed chrome.
 */
export function ProjectDetail({ id, pane = false }: { id: string | null; pane?: boolean }) {

  const { user } = useCurrentUser();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [siteLogs, setSiteLogs] = useState<SiteLog[]>([]);

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

  // The design's project screen leads with "3 logs on file · last 24/11/2026" and
  // then lists them; the previous build only offered a link to the filtered list.
  useEffect(() => {
    if (!id) return;
    let active = true;
    const fetchSiteLogs = async () => {
      try {
        const response = await apiFetch(`/api/worklogs?project=${id}`);
        if (!response.ok) return;
        const data = await response.json();
        if (active) setSiteLogs(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
      }
    };
    fetchSiteLogs();
    return () => {
      active = false;
    };
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
      <div className={pane ? "tb-pane pb-8" : "pb-8"}>
        <div className="px-4 pb-1 pt-3">
          <h1 className="t-title2">{toGreekUpperCase(code)}</h1>
          {name ? <p className="t-body mt-0.5">{name}</p> : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {project.status ? (
              <Pill tone={statusTone(project.status)}>{statusLabel(project.status)}</Pill>
            ) : null}
            <LocationLink
              location={project.location}
              latitude={project.latitude}
              longitude={project.longitude}
              className="t-footnote flex min-w-0 items-center gap-1 text-[color:var(--ios-ink2)]"
              iconClassName="h-3 w-3"
            />
          </div>
        </div>

        <OfflineBar>
          No signal. This site&rsquo;s logs open from the phone; new logs upload later.
        </OfflineBar>

        <div className="mx-4 mt-3 overflow-hidden rounded-[10px] bg-[color:var(--ios-card)] ios-hairline">
          <div className="flex divide-x divide-[color:var(--ios-sep)]">
            <div className="flex-1 px-4 py-3">
              <div className="t-title2 tabular-nums">{siteLogs.length}</div>
              <div className="t-footnote t-secondary mt-0.5">
                log{siteLogs.length === 1 ? "" : "s"} on file
              </div>
            </div>
            <div className="flex-1 px-4 py-3">
              <div className="t-title2 tabular-nums">
                {siteLogs[0]?.date ? formatDate(siteLogs[0].date) : '—'}
              </div>
              <div className="t-footnote t-secondary mt-0.5">Last log</div>
            </div>
          </div>
        </div>

        <div className="px-4 pt-4">
          <Btn block href={`/logs/new?project=${project._id}`}>
            New log for this site
          </Btn>
        </div>

        <Section
          title="Logs"
          icon="logs"
          action={
            <Link
              href={`/worklogs?project=${project._id}`}
              className="ios-head-link t-footnote font-medium text-[color:var(--ios-tint)]"
            >
              Open in Logs
            </Link>
          }
        >
          {siteLogs.length === 0 ? (
            <Empty
              icon="doc"
              title="No logs for this site"
              text="The site is on file but nothing is recorded yet. Write the first log for it."
            >
              <Btn variant="secondary" href={`/logs/new?project=${project._id}`}>
                Start a log
              </Btn>
            </Empty>
          ) : (
            siteLogs.slice(0, 5).map((log) => (
              <Row
                key={log._id}
                href={`/worklogs/${log._id}`}
                chevron
                trailing={
                  log.status ? (
                    <Pill tone={statusTone(log.status)}>{statusLabel(log.status)}</Pill>
                  ) : undefined
                }
              >
                <div className="t-body truncate font-semibold leading-[22px] tabular-nums">
                  {formatDate(log.date)}
                </div>
                <div className="t-subhead truncate leading-5 text-[color:var(--ios-ink2)]">
                  {log.workDescription?.split("\n")[0] || 'No description'}
                </div>
              </Row>
            ))
          )}
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
          {project.location && (
            <p>
              <strong>Location:</strong>{' '}
              <LocationLink
                location={project.location}
                latitude={project.latitude}
                longitude={project.longitude}
                iconClassName="h-3.5 w-3.5"
                className="inline-flex items-center gap-1"
              />
            </p>
          )}
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
