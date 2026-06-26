import { MapPin, ChevronRight, Loader2 } from 'lucide-react';
import type { IProject } from '@/lib/models';

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
 */
export function ProjectPicker({ projects, isLoading, onSelect }: ProjectPickerProps) {
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
                onClick={() => onSelect(project._id?.toString() ?? '')}
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
