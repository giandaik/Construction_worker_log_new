import { useMemo, useState } from 'react';
import { ChevronRight, Loader2, MapPin } from 'lucide-react';
import type { IProject } from '@/lib/models';
import { isNativeBundle } from '@/lib/native-mode';
import { LargeTitle, Pill, Row, Skeleton } from '@/components/native/ui';
import { SearchField } from '@/components/native/controls';

const STATUS_STYLES: Record<string, string> = {
  'planned': 'bg-blue-100 text-blue-800',
  'in-progress': 'bg-green-100 text-green-800',
  'completed': 'bg-gray-100 text-gray-600',
  'on-hold': 'bg-amber-100 text-amber-800',
};

/**
 * Small status pill. Shared by the picker cards and the locked-project header
 * so the two views read consistently.
 */
export function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const cls = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status.replace('-', ' ')}
    </span>
  );
}

/** Native tone for the same statuses, so pills match the design system. */
function statusTone(status?: string): 'ok' | 'plan' | 'warn' | 'draft' {
  if (status === 'in-progress') return 'ok';
  if (status === 'planned') return 'plan';
  if (status === 'on-hold') return 'warn';
  return 'draft';
}

interface ProjectPickerProps {
  projects: IProject[];
  isLoading: boolean;
  onSelect: (projectId: string) => void;
}

/**
 * Hero "which site today?" step of the guided work-log flow. Replaces the
 * project dropdown with big tappable cards so the one decision that gates the
 * whole form (catalog, prefill, signatures) is a deliberate first beat — not a
 * field buried among others.
 *
 * Native: search field, a RECENT group of the last two sites used, then ALL
 * SITES — the iOS selection-list grammar instead of a wall of bordered cards.
 */
export function ProjectPicker({ projects, isLoading, onSelect }: ProjectPickerProps) {
  const native = isNativeBundle();
  const [query, setQuery] = useState('');
  const [recentIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('cwl.recentSites');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      [p.name, p.location].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [projects, query]);

  const recent = useMemo(
    () => filtered.filter((p) => recentIds.includes(p._id?.toString() ?? '')).slice(0, 2),
    [filtered, recentIds],
  );
  const rest = useMemo(
    () => filtered.filter((p) => !recentIds.includes(p._id?.toString() ?? '')),
    [filtered, recentIds],
  );

  const choose = (project: IProject) => {
    const id = project._id?.toString() ?? '';
    try {
      const next = [id, ...recentIds.filter((r) => r !== id)].slice(0, 2);
      window.localStorage.setItem('cwl.recentSites', JSON.stringify(next));
    } catch {
      /* private mode — recents are a convenience, not state */
    }
    onSelect(id);
  };

  if (native) {
    return (
      <div className="pb-6">
        <LargeTitle sub="Ποιο έργο σήμερα; — pick the project to start your log.">
          Which site today?
        </LargeTitle>

        {isLoading ? (
          <Skeleton rows={5} />
        ) : projects.length === 0 ? (
          <p className="t-subhead t-secondary px-4 pt-6 text-center">
            No projects available yet. Ask an admin to create one.
          </p>
        ) : (
          <>
            <div className="pt-2" />
            <SearchField value={query} onChange={setQuery} placeholder="Search sites" />

            {recent.length > 0 && (
              <>
                <h2 className="t-footnote mb-1.5 px-4 font-medium uppercase tracking-[0.04em] text-[color:var(--ios-ink2)]">
                  Recent
                </h2>
                <div className="ios-hairline mx-4 overflow-hidden rounded-[10px] bg-[color:var(--ios-card)]">
                  {recent.map((project) => (
                    <Row
                      key={project._id?.toString()}
                      title={project.name}
                      subtitle={project.location}
                      onClick={() => choose(project)}
                      chevron
                      trailing={
                        <Pill tone={statusTone(project.status)}>
                          {project.status?.replace('-', ' ')}
                        </Pill>
                      }
                    />
                  ))}
                </div>
              </>
            )}

            <h2 className="t-footnote mb-1.5 px-4 pt-5 font-medium uppercase tracking-[0.04em] text-[color:var(--ios-ink2)]">
              All sites
            </h2>
            <div className="ios-hairline mx-4 overflow-hidden rounded-[10px] bg-[color:var(--ios-card)]">
              {rest.map((project) => (
                <Row
                  key={project._id?.toString()}
                  title={project.name}
                  subtitle={project.location}
                  onClick={() => choose(project)}
                  chevron
                  trailing={
                    <Pill tone={statusTone(project.status)}>{project.status?.replace('-', ' ')}</Pill>
                  }
                />
              ))}
              {rest.length === 0 && (
                <p className="t-subhead t-secondary px-4 py-6 text-center">No other sites match.</p>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">Which site today?</h2>
        <p className="text-sm text-muted-foreground">
          Ποιο έργο σήμερα; — pick the project to start your log.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-md border bg-card p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading sites…
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
          No projects available yet. Ask an admin to create one.
        </div>
      ) : (
        <ul className="space-y-2">
          {projects.map((project) => (
            <li key={project._id?.toString()}>
              <button
                type="button"
                onClick={() => choose(project)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-foreground truncate">
                      {project.name}
                    </span>
                    <StatusBadge status={project.status} />
                  </div>
                  {project.location && (
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground truncate">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {project.location}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
