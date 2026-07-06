import { useEffect, useState } from 'react';
import {
  EMPTY_CATALOG,
  toProjectCatalog,
  type ProjectCatalog,
} from '@/lib/catalog/mergeCatalog';

export type { ProjectCatalog };

/**
 * Fetches the strict-select catalog (personnel roles, equipment types, material
 * names, material units) for a project. Empty arrays when no project is selected
 * or the fetch fails — consumers fall back to free-text entry in that case.
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
        setCatalog(toProjectCatalog(data));
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
