'use client';

import { useEffect, useState } from 'react';

type SuggestionField =
  | 'personnel.role'
  | 'equipment.type'
  | 'materials.name'
  | 'materials.unit';

export function useSuggestions(field: SuggestionField, projectId?: string) {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ field });
    if (projectId) params.set('project', projectId);

    fetch(`/api/suggestions?${params.toString()}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { suggestions: [] }))
      .then((data) => setSuggestions(data.suggestions ?? []))
      .catch(() => {
        // Suggestions are a progressive enhancement — silently fall back to typing.
      });

    return () => controller.abort();
  }, [field, projectId]);

  return suggestions;
}
