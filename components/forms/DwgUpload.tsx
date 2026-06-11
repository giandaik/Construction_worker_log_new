'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Trash2 } from 'lucide-react';

export interface DwgFile {
  url: string;
  pathname?: string;
  filename: string;
  size: number;
  uploadedAt?: string | Date;
  uploadedBy?: string;
}

interface DwgUploadProps {
  projectId: string;
  value: DwgFile[];
  onChange: (files: DwgFile[]) => void;
  readOnly?: boolean;
}

const MAX_BYTES = 25 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DwgUpload({ projectId, value, onChange, readOnly = false }: DwgUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);

      const file = files[0];

      if (!file.name.toLowerCase().endsWith('.dwg')) {
        setError('Only .dwg files are allowed');
        return;
      }
      if (file.size > MAX_BYTES) {
        setError('File exceeds 25MB limit');
        return;
      }

      setBusy(true);
      try {
        const form = new FormData();
        form.append('file', file);
        form.append('projectId', projectId);

        const uploadRes = await fetch('/api/upload/dwg', { method: 'POST', body: form });
        if (!uploadRes.ok) {
          const body = await uploadRes.json().catch(() => ({}));
          throw new Error(body.error || `Upload failed (${uploadRes.status})`);
        }
        const blob = await uploadRes.json();

        const attachRes = await fetch(`/api/projects/${projectId}/dwgs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: blob.url,
            pathname: blob.pathname,
            filename: blob.filename,
            size: blob.size,
          }),
        });
        if (!attachRes.ok) {
          const body = await attachRes.json().catch(() => ({}));
          throw new Error(body.error || `Attach failed (${attachRes.status})`);
        }
        const updatedProject = await attachRes.json();
        onChange(updatedProject.dwgFiles ?? []);
      } catch (e) {
        console.error('DWG upload failed:', e);
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [projectId, onChange],
  );

  const removeFile = useCallback(
    async (url: string) => {
      setError(null);
      setBusy(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/dwgs`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Delete failed (${res.status})`);
        }
        const updatedProject = await res.json();
        onChange(updatedProject.dwgFiles ?? []);
      } catch (e) {
        console.error('DWG delete failed:', e);
        setError(e instanceof Error ? e.message : 'Delete failed');
      } finally {
        setBusy(false);
      }
    },
    [projectId, onChange],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Drawings (DWG)
          <span className="ml-2 text-xs text-gray-500">{value.length}</span>
        </label>
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? 'Working…' : 'Add DWG'}
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".dwg"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {value.length === 0 ? (
        <p className="text-sm text-gray-500">No drawings attached.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
          {value.map((dwg) => (
            <li key={dwg.url} className="flex items-center justify-between gap-3 px-3 py-2">
              <a
                href={dwg.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-1 items-center gap-2 text-sm text-blue-700 hover:underline"
              >
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{dwg.filename}</span>
              </a>
              <span className="flex-shrink-0 text-xs text-gray-500">{formatSize(dwg.size)}</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeFile(dwg.url)}
                  aria-label={`Remove ${dwg.filename}`}
                  disabled={busy}
                  className="flex-shrink-0 rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
