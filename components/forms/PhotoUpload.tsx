'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import {
  resizeImage,
  uploadImageBlob,
  blobToDataUrl,
  isDataUrl,
} from '@/lib/imageResize';

interface PhotoUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxPhotos?: number;
}

export function PhotoUpload({ value, onChange, maxPhotos = 10 }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isOnline = useOnlineStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);

      const remaining = maxPhotos - value.length;
      const toProcess = Array.from(files).slice(0, remaining);
      if (toProcess.length === 0) {
        setError(`Maximum ${maxPhotos} photos`);
        return;
      }

      setBusy(true);

      const results = await Promise.allSettled(
        toProcess.map(async (file) => {
          const resized = await resizeImage(file);
          return isOnline ? uploadImageBlob(resized) : blobToDataUrl(resized);
        }),
      );

      const added: string[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          added.push(result.value);
        } else {
          console.error('Photo processing failed:', result.reason);
          setError(result.reason instanceof Error ? result.reason.message : 'Photo processing failed');
        }
      }

      if (added.length > 0) onChange([...value, ...added]);
      setBusy(false);

      if (inputRef.current) inputRef.current.value = '';
    },
    [value, onChange, isOnline, maxPhotos],
  );

  const removeAt = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Photos
          <span className="ml-2 text-xs text-gray-500">
            {value.length}/{maxPhotos}
          </span>
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy || value.length >= maxPhotos}
        >
          {busy ? 'Processing…' : 'Add Photos'}
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((src, i) => {
            const pending = isDataUrl(src);
            return (
              <div
                key={`${i}-${src.slice(0, 32)}`}
                className="group relative aspect-square overflow-hidden rounded-md border border-gray-200 bg-gray-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Photo ${i + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {pending && (
                  <span className="absolute left-1 top-1 rounded bg-yellow-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                    Pending
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute right-1 top-1 rounded-full bg-red-600 px-1.5 py-0.5 text-xs text-white opacity-90 hover:opacity-100"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!isOnline && value.some(isDataUrl) && (
        <p className="text-xs text-amber-700">
          Pending photos will upload when you reconnect.
        </p>
      )}
    </div>
  );
}
