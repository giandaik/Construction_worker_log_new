'use client';

import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CATALOG_FIELDS } from './CatalogFields';
import {
  toProjectCatalog,
  mergeCatalog,
  diffCatalog,
  EMPTY_CATALOG,
  type ProjectCatalog,
} from '@/lib/catalog/mergeCatalog';

interface CatalogSource {
  _id: string;
  name: string;
  total: number;
}

interface CatalogImportDialogProps {
  /** Catalog the dialog merges into (current project or in-progress form). */
  currentCatalog: ProjectCatalog;
  /** Project to exclude from the source list (omit during creation). */
  currentProjectId?: string;
  /**
   * "apply": write the merge to the server for `currentProjectId`.
   * "prefill": hand the merged catalog back to the caller (no API write).
   */
  mode: 'apply' | 'prefill';
  /** Called after a successful server merge (apply mode). */
  onApplied?: (updated: Record<string, unknown>) => void;
  /** Called with the merged catalog (prefill mode). */
  onPrefill?: (merged: ProjectCatalog) => void;
}

function totalAdded(diff: ReturnType<typeof diffCatalog>): number {
  return Object.values(diff).reduce((sum, d) => sum + d.added, 0);
}

export function CatalogImportDialog({
  currentCatalog,
  currentProjectId,
  mode,
  onApplied,
  onPrefill,
}: CatalogImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<CatalogSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [sourceId, setSourceId] = useState<string>('');
  const [sourceCatalog, setSourceCatalog] = useState<ProjectCatalog | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingSources(true);
      setError(null);
      try {
        const res = await fetch('/api/projects/catalog-sources');
        if (!res.ok) throw new Error('Αποτυχία φόρτωσης project');
        const data: CatalogSource[] = await res.json();
        if (cancelled) return;
        setSources(data.filter((p) => p._id !== currentProjectId));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Σφάλμα φόρτωσης');
      } finally {
        if (!cancelled) setLoadingSources(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, currentProjectId]);

  async function handleSelectSource(id: string) {
    setSourceId(id);
    setSourceCatalog(null);
    setError(null);
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error('Αποτυχία φόρτωσης καταλόγου');
      const data = await res.json();
      setSourceCatalog(toProjectCatalog(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Σφάλμα φόρτωσης');
    } finally {
      setLoadingPreview(false);
    }
  }

  function reset() {
    setSourceId('');
    setSourceCatalog(null);
    setError(null);
  }

  async function handleConfirm() {
    if (!sourceCatalog || !sourceId) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'apply') {
        if (!currentProjectId) throw new Error('Λείπει το project');
        const res = await fetch(`/api/projects/${currentProjectId}/catalog/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceProjectId: sourceId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message ?? 'Η αντιγραφή απέτυχε');
        }
        onApplied?.(await res.json());
      } else {
        onPrefill?.(mergeCatalog(currentCatalog, sourceCatalog));
      }
      setOpen(false);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Η αντιγραφή απέτυχε');
    } finally {
      setSubmitting(false);
    }
  }

  const diff = sourceCatalog ? diffCatalog(currentCatalog, sourceCatalog) : null;
  const added = diff ? totalAdded(diff) : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Copy className="mr-2 h-4 w-4" />
          Αντιγραφή επιλογών από άλλο project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Αντιγραφή επιλογών</DialogTitle>
          <DialogDescription>
            Διάλεξε ένα project για να φέρεις τις λίστες επιλογών του. Οι επιλογές
            <strong> προστίθενται</strong> — δεν σβήνεται τίποτα από τις δικές σου.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Από project</label>
            <Select value={sourceId} onValueChange={handleSelectSource} disabled={loadingSources}>
              <SelectTrigger aria-label="Πηγαίο project">
                <SelectValue placeholder={loadingSources ? 'Φόρτωση…' : 'Διάλεξε project'} />
              </SelectTrigger>
              <SelectContent>
                {sources.map((p) => (
                  <SelectItem key={p._id} value={p._id} disabled={p.total === 0}>
                    {p.name} {p.total === 0 ? '(κενός κατάλογος)' : `(${p.total})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!loadingSources && sources.length === 0 && (
              <p className="text-xs text-muted-foreground">Δεν υπάρχει άλλο project.</p>
            )}
          </div>

          {loadingPreview && <p className="text-sm text-muted-foreground">Φόρτωση προεπισκόπησης…</p>}

          {diff && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="mb-1 font-medium">
                {added > 0 ? `Θα προστεθούν ${added} νέες επιλογές:` : 'Όλες υπάρχουν ήδη.'}
              </div>
              <ul className="space-y-0.5">
                {CATALOG_FIELDS.map((field) => {
                  const d = diff[field.key];
                  if (d.added === 0 && d.existing === 0) return null;
                  return (
                    <li key={field.key} className="text-muted-foreground">
                      <span className="text-foreground">{field.label}:</span>{' '}
                      {d.added > 0 ? `+${d.added} νέες` : 'καμία νέα'}
                      {d.existing > 0 ? `, ${d.existing} ήδη υπάρχουν` : ''}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Άκυρο
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !sourceCatalog || added === 0}
          >
            {submitting ? 'Αντιγραφή…' : 'Αντιγραφή'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { EMPTY_CATALOG };
