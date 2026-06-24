import { useEffect, useState } from 'react';

export interface ProjectCatalog {
  personnelRoles: string[];
  equipmentTypes: string[];
  materialNames: string[];
  materialUnits: string[];
}

const EMPTY_CATALOG: ProjectCatalog = {
  personnelRoles: [],
  equipmentTypes: [],
  materialNames: [],
  materialUnits: [],
};

/**
 * Fetches the strict-select catalog (personnel roles, equipment types, material
 * names, material units) for a project. Empty arrays when no project is selected
 * or the fetch fails.
 */
export function useProjectCatalog(projectId: string | undefined | null) {
  const [catalog, setCatalog] = useState<ProjectCatalog>(EMPTY_CATALOG);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setCatalog(EMPTY_CATALOG);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) throw new Error('Failed to fetch project catalog');
        const data = await res.json();
        if (cancelled) return;
        setCatalog({
          personnelRoles: data.personnelRoles ?? [],
          equipmentTypes: data.equipmentTypes ?? [],
          materialNames: data.materialNames ?? [],
          materialUnits: data.materialUnits ?? [],
        });
      } catch (err) {
        console.error('useProjectCatalog:', err);
        if (!cancelled) setCatalog(EMPTY_CATALOG);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { catalog, isLoading };
}
