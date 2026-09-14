'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_FILES,
  MAX_FILE_BYTES,
  SAMPLE_MUSIC_URL,
  UnsupportedAudioError,
  decodePreviewSlice,
  renderDownload,
  renderPreview,
  type MixSettings,
  type Rendered,
} from '@/lib/audio';

export interface PreparedTracks {
  /** Kept as Files, not decoded buffers: the browser backs these by the file on
   *  disk, so five of them cost nothing while five decoded tracks cost ~400MB. */
  files: File[];
  /** A 10-second slice of the first track, cheap to re-render on every change. */
  preview: AudioBuffer;
}

const megabytes = (bytes: number) => Math.round(bytes / (1024 * 1024));

function describe(error: unknown): string {
  if (error instanceof UnsupportedAudioError) {
    return `${error.message}. This browser may not support that format — try MP3 or WAV.`;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}

/**
 * The whole audio pipeline, as React sees it. Replaces the old useApiClient:
 * same call shape, but nothing leaves the browser.
 */
export function useAudioEngine() {
  const [progress, setProgress] = useState<number | null>(null);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const prepareFiles = useCallback(async (files: File[]): Promise<PreparedTracks> => {
    if (files.length === 0) throw new Error('No files selected');
    if (files.length > MAX_FILES) {
      throw new Error(`You can work with at most ${MAX_FILES} files at once.`);
    }
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        throw new Error(`${file.name} is larger than the ${megabytes(MAX_FILE_BYTES)}MB limit.`);
      }
    }
    return { files, preview: await decodePreviewSlice(files[0]) };
  }, []);

  const prepareSample = useCallback(async (): Promise<PreparedTracks> => {
    const response = await fetch(SAMPLE_MUSIC_URL);
    if (!response.ok) throw new Error('Could not load the sample track');
    const blob = await response.blob();
    const file = new File([blob], 'sample-track.mp3', { type: 'audio/mpeg' });
    return prepareFiles([file]);
  }, [prepareFiles]);

  const preview = useCallback(
    (buffer: AudioBuffer, settings: MixSettings) => renderPreview(buffer, settings),
    [],
  );

  const download = useCallback(
    async (files: File[], settings: MixSettings, merge: boolean): Promise<Rendered> => {
      setProgress(0);
      try {
        return await renderDownload(files, settings, merge, (fraction) => {
          if (mounted.current) setProgress(fraction);
        });
      } finally {
        if (mounted.current) setProgress(null);
      }
    },
    [],
  );

  return { prepareFiles, prepareSample, preview, download, progress, describe };
}
