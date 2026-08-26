'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { isMobileApp } from '@/lib/mobile-auth';
import {
  resizeImage,
  uploadImageBlob,
  blobToDataUrl,
  isDataUrl,
} from '@/lib/imageResize';

/**
 * Camera JPEG quality. `resizeImage` re-encodes afterwards anyway, so this only
 * needs to be high enough not to lose detail before that second pass.
 */
const CAPTURE_QUALITY = 80;

interface PhotoUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxPhotos?: number;
}

/**
 * Turns a native capture result into a `File` so it can go through the same
 * resize/upload pipeline as a web file input. `webPath` is a WebView-readable
 * URL for the on-device file, so `fetch` is the supported way to get its bytes.
 */
async function fileFromWebPath(webPath: string | undefined, index: number): Promise<File> {
  if (!webPath) throw new Error('The camera returned a photo with no readable path');

  const response = await fetch(webPath);
  if (!response.ok) throw new Error(`Could not read the captured photo (${response.status})`);

  const blob = await response.blob();
  return new File([blob], `capture-${Date.now()}-${index}.jpg`, {
    type: blob.type || 'image/jpeg',
  });
}

/**
 * Runs a native picker and returns the captured photos as `File`s, or null if
 * the user backed out.
 *
 * `source: 'camera'` opens the device camera for a single shot; `'gallery'`
 * opens the multi-select picker, capped at `limit`. Capacitor 8.2 replaced the
 * old single `getPhoto` + `CameraSource.Prompt` with these two calls and expects
 * the app to supply the source UI — hence two buttons rather than a native
 * prompt.
 *
 * The plugin is behind a dynamic import so the web bundle never loads it.
 */
async function captureNativePhotos(
  source: 'camera' | 'gallery',
  limit: number,
): Promise<File[] | null> {
  const { Camera, CameraErrorCode } = await import('@capacitor/camera');

  let captured;
  try {
    captured =
      source === 'camera'
        ? [await Camera.takePhoto({ quality: CAPTURE_QUALITY, saveToGallery: false })]
        : (
            await Camera.chooseFromGallery({
              allowMultipleSelection: true,
              limit,
              quality: CAPTURE_QUALITY,
            })
          ).results;
  } catch (caught) {
    const { code } = caught as { code?: string };

    // Backing out of the camera or the picker is a normal outcome, not a failure
    // worth putting on screen. Permission denials carry their own codes and are
    // deliberately not swallowed here.
    if (
      code === CameraErrorCode.TakePhotoCancelled ||
      code === CameraErrorCode.ChooseMediaCancelled
    ) {
      return null;
    }
    throw caught;
  }

  return Promise.all(
    captured.slice(0, limit).map((result, index) => fileFromWebPath(result.webPath, index)),
  );
}

export function PhotoUpload({ value, onChange, maxPhotos = 10 }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isOnline = useOnlineStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Picks the camera UI. Starts false so the server render and the first client
  // render agree; only the native shell flips it, after mount.
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isMobileApp().then((native) => {
      if (!cancelled) setIsNative(native);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const remaining = maxPhotos - value.length;

  /**
   * Shared resize → upload-or-stash pipeline. Callers own `busy` and clearing
   * `error`, since on native the picker runs before any file exists.
   */
  const processFiles = useCallback(
    async (files: File[]) => {
      const toProcess = files.slice(0, maxPhotos - value.length);
      if (toProcess.length === 0) {
        setError(`Maximum ${maxPhotos} photos`);
        return;
      }

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
    },
    [value, onChange, isOnline, maxPhotos],
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setError(null);
      setBusy(true);
      try {
        await processFiles(Array.from(files));
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [processFiles],
  );

  const addFromNative = useCallback(
    async (source: 'camera' | 'gallery') => {
      setError(null);

      if (remaining <= 0) {
        setError(`Maximum ${maxPhotos} photos`);
        return;
      }

      setBusy(true);
      try {
        const files = await captureNativePhotos(source, remaining);
        if (files) await processFiles(files);
      } catch (caught) {
        console.error('Native photo capture failed:', caught);
        setError(caught instanceof Error ? caught.message : 'Could not add the photo');
      } finally {
        setBusy(false);
      }
    },
    [processFiles, remaining, maxPhotos],
  );

  const removeAt = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange],
  );

  const addDisabled = busy || remaining <= 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-foreground">
          Photos
          <span className="ml-2 text-xs text-muted-foreground">
            {value.length}/{maxPhotos}
          </span>
          {isNative && busy && (
            <span className="ml-2 text-xs text-muted-foreground">Processing…</span>
          )}
        </label>

        {isNative ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addFromNative('camera')}
              disabled={addDisabled}
            >
              Take Photo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addFromNative('gallery')}
              disabled={addDisabled}
            >
              Gallery
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={addDisabled}
          >
            {busy ? 'Processing…' : 'Add Photos'}
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((src, i) => {
            const pending = isDataUrl(src);
            return (
              <div
                key={`${i}-${src.slice(0, 32)}`}
                className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted/50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Photo ${i + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {pending && (
                  <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary-foreground">
                    Pending
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute right-1 top-1 rounded-full bg-destructive px-1.5 py-0.5 text-xs text-destructive-foreground opacity-90 hover:opacity-100"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!isOnline && value.some(isDataUrl) && (
        <p className="text-xs text-muted-foreground">
          Pending photos will upload when you reconnect.
        </p>
      )}
    </div>
  );
}
