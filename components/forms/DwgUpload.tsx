'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, FileType2, Trash2 } from 'lucide-react';

export interface DwgFile {
  url: string;
  pathname?: string;
  filename: string;
  size: number;
  pdfUrl?: string;
  pdfFilename?: string;
  pdfSize?: number;
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
  const dwgInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [dwgFile, setDwgFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setDwgFile(null);
    setPdfFile(null);
    setDraftOpen(false);
    setError(null);
    if (dwgInputRef.current) dwgInputRef.current.value = '';
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  }, []);

  const submitDraft = useCallback(async () => {
    setError(null);
    if (!dwgFile) {
      setError('Pick a .dwg file first');
      return;
    }
    if (!dwgFile.name.toLowerCase().endsWith('.dwg')) {
      setError('Drawing must be a .dwg file');
      return;
    }
    if (dwgFile.size > MAX_BYTES) {
      setError('DWG exceeds 25MB limit');
      return;
    }
    if (pdfFile) {
      if (!pdfFile.name.toLowerCase().endsWith('.pdf')) {
        setError('Companion must be a .pdf file');
        return;
      }
      if (pdfFile.size > MAX_BYTES) {
        setError('PDF exceeds 25MB limit');
        return;
      }
    }

    setBusy(true);
    try {
      const dwgForm = new FormData();
      dwgForm.append('file', dwgFile);
      dwgForm.append('projectId', projectId);

      const dwgPromise = fetch('/api/upload/dwg', { method: 'POST', body: dwgForm }).then(
        async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `DWG upload failed (${res.status})`);
          }
          return res.json();
        },
      );

      const pdfPromise: Promise<{ url: string; pathname: string; filename: string; size: number } | null> = pdfFile
        ? (() => {
            const pdfForm = new FormData();
            pdfForm.append('file', pdfFile);
            pdfForm.append('projectId', projectId);
            return fetch('/api/upload/pdf', { method: 'POST', body: pdfForm }).then(async (res) => {
              if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `PDF upload failed (${res.status})`);
              }
              return res.json();
            });
          })()
        : Promise.resolve(null);

      const [dwgBlob, pdfBlob] = await Promise.all([dwgPromise, pdfPromise]);

      const attachBody: Record<string, unknown> = {
        url: dwgBlob.url,
        pathname: dwgBlob.pathname,
        filename: dwgBlob.filename,
        size: dwgBlob.size,
      };
      if (pdfBlob) {
        attachBody.pdfUrl = pdfBlob.url;
        attachBody.pdfFilename = pdfBlob.filename;
        attachBody.pdfSize = pdfBlob.size;
      }

      const attachRes = await fetch(`/api/projects/${projectId}/dwgs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attachBody),
      });
      if (!attachRes.ok) {
        const body = await attachRes.json().catch(() => ({}));
        throw new Error(body.error || `Attach failed (${attachRes.status})`);
      }
      const updatedProject = await attachRes.json();
      onChange(updatedProject.dwgFiles ?? []);
      reset();
    } catch (e) {
      console.error('Drawing upload failed:', e);
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }, [dwgFile, pdfFile, projectId, onChange, reset]);

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
          Drawings
          <span className="ml-2 text-xs text-gray-500">{value.length}</span>
        </label>
        {!readOnly && !draftOpen && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDraftOpen(true)}
            disabled={busy}
          >
            Add Drawing
          </Button>
        )}
      </div>

      {draftOpen && !readOnly && (
        <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs text-gray-600">
            Pick a .dwg drawing and optionally a .pdf companion that workers can preview on their phone.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => dwgInputRef.current?.click()}
              disabled={busy}
            >
              <FileText className="mr-2 h-4 w-4" />
              {dwgFile ? dwgFile.name : 'Choose .dwg (required)'}
            </Button>
            <input
              ref={dwgInputRef}
              type="file"
              accept=".dwg"
              className="hidden"
              onChange={(e) => setDwgFile(e.target.files?.[0] ?? null)}
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => pdfInputRef.current?.click()}
              disabled={busy}
            >
              <FileType2 className="mr-2 h-4 w-4" />
              {pdfFile ? pdfFile.name : 'Choose .pdf (optional)'}
            </Button>
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={submitDraft} disabled={busy || !dwgFile}>
              {busy ? 'Uploading…' : 'Upload'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!draftOpen && error && <p className="text-sm text-red-600">{error}</p>}

      {value.length === 0 ? (
        <p className="text-sm text-gray-500">No drawings attached.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
          {value.map((dwg) => (
            <li key={dwg.url} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <a
                  href={dwg.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-2 text-sm text-blue-700 hover:underline"
                >
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{dwg.filename}</span>
                  <span className="flex-shrink-0 text-xs text-gray-500">{formatSize(dwg.size)}</span>
                </a>
                {dwg.pdfUrl && (
                  <a
                    href={dwg.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 items-center gap-2 text-sm text-blue-700 hover:underline"
                  >
                    <FileType2 className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{dwg.pdfFilename ?? 'View PDF'}</span>
                    {typeof dwg.pdfSize === 'number' && (
                      <span className="flex-shrink-0 text-xs text-gray-500">{formatSize(dwg.pdfSize)}</span>
                    )}
                  </a>
                )}
              </div>
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
