'use client';

import { useState } from 'react';
import { CatalogFields } from './CatalogFields';
import { CatalogImportDialog } from './CatalogImportDialog';
import { useToast } from '@/hooks/useToast';
import { Alert } from '@/components/ui/alert';
import { toProjectCatalog, type ProjectCatalog } from '@/lib/catalog/mergeCatalog';
import type { CatalogKind } from '@/lib/schemas/projectSchema';

export type { ProjectCatalog };

interface ProjectCatalogManagerProps {
  projectId: string;
  initial: ProjectCatalog;
  readOnly?: boolean;
}

export function ProjectCatalogManager({
  projectId,
  initial,
  readOnly,
}: ProjectCatalogManagerProps) {
  const [catalog, setCatalog] = useState<ProjectCatalog>(initial);
  const [savingKind, setSavingKind] = useState<CatalogKind | null>(null);
  const { toast, showSuccess, showError } = useToast();

  const persist = async (kind: CatalogKind, values: string[]) => {
    const previous = catalog[kind];
    setCatalog((prev) => ({ ...prev, [kind]: values }));
    setSavingKind(kind);
    try {
      const res = await fetch(`/api/projects/${projectId}/catalog`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, values }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'Save failed');
      }
      showSuccess('Αποθηκεύτηκε');
    } catch (e) {
      setCatalog((prev) => ({ ...prev, [kind]: previous }));
      showError(e instanceof Error ? e.message : 'Αποθήκευση απέτυχε');
    } finally {
      setSavingKind(null);
    }
  };

  return (
    <div className="space-y-4">
      {toast && <Alert variant={toast.type}>{toast.message}</Alert>}
      {!readOnly && (
        <div className="flex justify-end">
          <CatalogImportDialog
            mode="apply"
            currentProjectId={projectId}
            currentCatalog={catalog}
            onApplied={(updated) => {
              setCatalog(toProjectCatalog(updated as Partial<ProjectCatalog>));
              showSuccess('Αντιγράφηκαν οι επιλογές');
            }}
          />
        </div>
      )}
      <CatalogFields
        catalog={catalog}
        onChange={persist}
        busyKind={savingKind}
        readOnly={readOnly}
      />
    </div>
  );
}
