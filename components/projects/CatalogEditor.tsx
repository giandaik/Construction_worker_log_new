'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CatalogEditorProps {
  label: string;
  placeholder?: string;
  values: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

export function CatalogEditor({
  label,
  placeholder,
  values,
  onChange,
  disabled,
}: CatalogEditorProps) {
  const [draft, setDraft] = useState('');

  const addValue = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (values.includes(trimmed)) {
      setDraft('');
      return;
    }
    onChange([...values, trimmed]);
    setDraft('');
  };

  const removeAt = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex flex-wrap gap-2">
        {values.length === 0 && (
          <span className="text-xs text-muted-foreground italic">Καμία επιλογή ακόμη.</span>
        )}
        {values.map((value, index) => (
          <span
            key={`${value}-${index}`}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs"
          >
            {value}
            {!disabled && (
              <button
                type="button"
                aria-label={`Remove ${value}`}
                onClick={() => removeAt(index)}
                className="rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addValue();
              }
            }}
            placeholder={placeholder}
            className="block w-full rounded-md border-input bg-background px-3 py-1 text-sm shadow-sm focus:border-ring focus:ring-ring"
          />
          <Button type="button" size="sm" variant="outline" onClick={addValue}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
      )}
    </div>
  );
}
