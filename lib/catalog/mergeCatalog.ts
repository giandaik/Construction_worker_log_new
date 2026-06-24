import { CATALOG_KINDS, type CatalogKind } from '@/lib/schemas/projectSchema';

/**
 * A project's four strict-select option lists, keyed by catalog kind.
 */
export type ProjectCatalog = Record<CatalogKind, string[]>;

export const EMPTY_CATALOG: ProjectCatalog = {
  personnelRoles: [],
  equipmentTypes: [],
  materialNames: [],
  materialUnits: [],
};

/**
 * Normalize an unknown-shaped object into a full ProjectCatalog, filling missing
 * kinds with empty arrays. Tolerates partial documents straight from the DB.
 */
export function toProjectCatalog(source: Partial<Record<CatalogKind, unknown>> | null | undefined): ProjectCatalog {
  const out = { ...EMPTY_CATALOG };
  if (!source) return out;
  for (const kind of CATALOG_KINDS) {
    const value = source[kind];
    out[kind] = Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  }
  return out;
}

/**
 * Union of two value lists: trimmed, blanks dropped, de-duplicated. Base order is
 * preserved and incoming values that are genuinely new are appended in order.
 */
export function mergeCatalogValues(base: string[], incoming: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of [...base, ...incoming]) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Additive merge of a source catalog into a base catalog, per kind. Never
 * deletes; only adds values the base does not already have.
 */
export function mergeCatalog(base: ProjectCatalog, source: ProjectCatalog): ProjectCatalog {
  return {
    personnelRoles: mergeCatalogValues(base.personnelRoles, source.personnelRoles),
    equipmentTypes: mergeCatalogValues(base.equipmentTypes, source.equipmentTypes),
    materialNames: mergeCatalogValues(base.materialNames, source.materialNames),
    materialUnits: mergeCatalogValues(base.materialUnits, source.materialUnits),
  };
}

export interface CatalogKindDiff {
  added: number;
  existing: number;
}

export type CatalogDiff = Record<CatalogKind, CatalogKindDiff>;

/**
 * For each kind, how many source values are new to the base vs already present.
 * Drives the import preview ("+5 new, 2 already exist").
 */
export function diffCatalog(base: ProjectCatalog, source: ProjectCatalog): CatalogDiff {
  const out = {} as CatalogDiff;
  for (const kind of CATALOG_KINDS) {
    const baseSet = new Set(base[kind].map((v) => v.trim()).filter(Boolean));
    let added = 0;
    let existing = 0;
    const counted = new Set<string>();
    for (const value of source[kind]) {
      const trimmed = value.trim();
      if (!trimmed || counted.has(trimmed)) continue;
      counted.add(trimmed);
      if (baseSet.has(trimmed)) existing += 1;
      else added += 1;
    }
    out[kind] = { added, existing };
  }
  return out;
}

/** Total number of values across all four kinds (for source-picker labels). */
export function totalCatalogCount(catalog: ProjectCatalog): number {
  return CATALOG_KINDS.reduce((sum, kind) => sum + catalog[kind].length, 0);
}
