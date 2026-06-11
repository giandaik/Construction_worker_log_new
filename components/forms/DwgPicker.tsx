'use client';

import React, { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import type { DwgFile } from '@/components/forms/DwgUpload';

interface DwgPickerProps {
  projectId: string;
  value: string[];
  onChange: (urls: string[]) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DwgPicker({ projectId, value, onChange }: DwgPickerProps) {
  const [dwgFiles, setDwgFiles] = useState<DwgFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setDwgFiles([]);
      return;
    }
    let cancelled = false;
    const fetchDwgs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        const project = await res.json();
        if (!cancelled) setDwgFiles(project.dwgFiles ?? []);
      } catch (e) {
        if (!cancelled) {
          console.error('DwgPicker fetch failed:', e);
          setError(e instanceof Error ? e.message : 'Failed to load drawings');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchDwgs();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!projectId) return null;

  const toggle = (url: string) => {
    if (value.includes(url)) {
      onChange(value.filter((u) => u !== url));
    } else {
      onChange([...value, url]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Drawings used today
          {dwgFiles.length > 0 && (
            <span className="ml-2 text-xs text-gray-500">
              {value.length} of {dwgFiles.length} selected
            </span>
          )}
        </label>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading drawings…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!isLoading && !error && dwgFiles.length === 0 && (
        <p className="text-sm text-gray-500">No drawings attached to this project.</p>
      )}

      {dwgFiles.length > 0 && (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
          {dwgFiles.map((dwg) => {
            const checked = value.includes(dwg.url);
            return (
              <li key={dwg.url} className="flex items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(dwg.url)}
                  aria-label={`Select ${dwg.filename}`}
                  className="h-4 w-4"
                />
                <FileText className="h-4 w-4 flex-shrink-0 text-gray-500" />
                <span className="min-w-0 flex-1 truncate text-sm">{dwg.filename}</span>
                <span className="flex-shrink-0 text-xs text-gray-500">{formatSize(dwg.size)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
