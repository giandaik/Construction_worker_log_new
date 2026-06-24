'use client';

import { CatalogEditor } from './CatalogEditor';
import type { CatalogKind } from '@/lib/schemas/projectSchema';
import type { ProjectCatalog } from '@/lib/catalog/mergeCatalog';

export const CATALOG_FIELDS: Array<{
  key: CatalogKind;
  label: string;
  placeholder: string;
}> = [
  { key: 'personnelRoles', label: 'Ρόλοι Προσωπικού', placeholder: 'π.χ. Εργάτης' },
  { key: 'equipmentTypes', label: 'Μηχανήματα', placeholder: 'π.χ. Εκσκαφέας' },
  { key: 'materialNames', label: 'Υλικά', placeholder: 'π.χ. Σκυρόδεμα' },
  { key: 'materialUnits', label: 'Μονάδες Μέτρησης', placeholder: 'π.χ. m³, kg, τεμ.' },
];

interface CatalogFieldsProps {
  catalog: ProjectCatalog;
  onChange: (kind: CatalogKind, values: string[]) => void;
  /** A single kind currently mid-save (disables just that editor). */
  busyKind?: CatalogKind | null;
  readOnly?: boolean;
}

/**
 * Pure, controlled grid of the four catalog editors. Shared by the
 * API-persisted ProjectCatalogManager and the local-state NewProjectForm.
 */
export function CatalogFields({ catalog, onChange, busyKind, readOnly }: CatalogFieldsProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {CATALOG_FIELDS.map((field) => (
        <CatalogEditor
          key={field.key}
          label={field.label}
          placeholder={field.placeholder}
          values={catalog[field.key]}
          onChange={(next) => onChange(field.key, next)}
          disabled={readOnly || busyKind === field.key}
        />
      ))}
    </div>
  );
}
