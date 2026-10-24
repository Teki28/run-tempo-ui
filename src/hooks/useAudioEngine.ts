'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_FILES,
  MAX_FILE_BYTES,
  SAMPLE_MUSIC_URL,
  UnsupportedAudioError,
  prepareTrack,
  renderDownload,
  type AnalysisStage,
  type MixSettings,
  type PreparedTrack,
  type Rendered,
} from '@/lib/audio';

export interface PreparedTracks {
  /** Kept as Files, not decoded buffers: the browser backs these by the file on
   *  disk, so five of them cost nothing while five decoded tracks cost ~400MB. */
  files: File[];
  /** The first track, decoded to a preview slice. Analysis happens later. */
  first: PreparedTrack | null;
}

/** What the UI shows while a long job is running. */
export interface Activity {
  phase: AnalysisStage | 'stretching' | 'encoding' | 'preparing';
  fraction: number;
}

const megabytes = (bytes: number) => Math.round(bytes / (1024 * 1024));

function describe(error: unknown): string {
  if (error instanceof UnsupportedAudioError) {
    return `${error.message}. This browser may not support that format — try MP3 or WAV.`;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}

/**
 * The whole audio pipeline, as React sees it.
 *
 * Analysis is deliberately not run here on upload. It is the most expensive
 * step and a user who drops five files and changes their mind should not pay
 * for it; `analyse` is called on the first audition or download instead, and
 * the result is cached by content hash so it is paid for only once.
 */
export function useAudioEngine() {
  const [progress, setProgress] = useState<number | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const report = useCallback((phase: Activity['phase'], fraction: number) => {
    if (mounted.current) setActivity({ phase, fraction });
  }, []);

  const validate = useCallback((files: File[]) => {
    if (files.length === 0) throw new Error('No files selected');
    if (files.length > MAX_FILES) {
      throw new Error(`You can work with at most ${MAX_FILES} files at once.`);
    }
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        throw new Error(`${file.name} is larger than the ${megabytes(MAX_FILE_BYTES)}MB limit.`);
      }
    }
  }, []);

  /** Accept files without analysing them: just enough to show the UI. */
  const prepareFiles = useCallback(
    async (files: File[]): Promise<PreparedTracks> => {
      validate(files);
      return { files, first: null };
    },
    [validate],
  );

  const prepareSample = useCallback(async (): Promise<PreparedTracks> => {
    const response = await fetch(SAMPLE_MUSIC_URL);
    if (!response.ok) throw new Error('Could not load the sample track');
    const blob = await response.blob();
    const file = new File([blob], 'sample-track.mp3', { type: 'audio/mpeg' });
    return prepareFiles([file]);
  }, [prepareFiles]);

  /** Decode and analyse one file, reporting progress. Cached after the first run. */
  const analyse = useCallback(
    async (file: File): Promise<PreparedTrack> => {
      report('preparing', 0);
      try {
        return await prepareTrack(file, (stage, fraction) => report(stage, fraction));
      } finally {
        if (mounted.current) setActivity(null);
      }
    },
    [report],
  );

  const download = useCallback(
    async (files: File[], settings: MixSettings, merge: boolean): Promise<Rendered> => {
      setProgress(0);
      try {
        return await renderDownload(
          files,
          settings,
          merge,
          (fraction) => {
            if (mounted.current) setProgress(fraction);
          },
          (phase, fraction) => report(phase as Activity['phase'], fraction),
        );
      } finally {
        if (mounted.current) {
          setProgress(null);
          setActivity(null);
        }
      }
    },
    [report],
  );

  return { prepareFiles, prepareSample, analyse, download, progress, activity, describe };
}
