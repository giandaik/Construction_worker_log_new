'use client';

import { useState } from 'react';
import { CatalogEditor } from './CatalogEditor';
import { useToast } from '@/hooks/useToast';
import { Alert } from '@/components/ui/alert';
import type { CatalogKind } from '@/lib/schemas/projectSchema';

export interface ProjectCatalog {
  personnelRoles: string[];
  equipmentTypes: string[];
  materialNames: string[];
  materialUnits: string[];
}

interface ProjectCatalogManagerProps {
  projectId: string;
  initial: ProjectCatalog;
  readOnly?: boolean;
}

const FIELDS: Array<{
  key: CatalogKind;
  label: string;
  placeholder: string;
}> = [
  { key: 'personnelRoles', label: 'Ρόλοι Προσωπικού', placeholder: 'π.χ. Εργάτης' },
  { key: 'equipmentTypes', label: 'Μηχανήματα', placeholder: 'π.χ. Εκσκαφέας' },
  { key: 'materialNames', label: 'Υλικά', placeholder: 'π.χ. Σκυρόδεμα' },
  { key: 'materialUnits', label: 'Μονάδες Μέτρησης', placeholder: 'π.χ. m³, kg, τεμ.' },
];

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
      <div className="grid gap-6 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <CatalogEditor
              label={field.label}
              placeholder={field.placeholder}
              values={catalog[field.key]}
              onChange={(next) => persist(field.key, next)}
              disabled={readOnly || savingKind === field.key}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
