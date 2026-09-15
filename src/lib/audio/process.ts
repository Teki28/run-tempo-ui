import { loadClick } from './click';
import { PREVIEW_SECONDS } from './constants';
import { decodeAudioFile } from './decode';
import { Mp3Session, encodeToMp3 } from './encode';
import { renderWithMetronome } from './render';
import { sliceSeconds } from './slice';
import { zipFiles } from './zip';

export interface MixSettings {
  bpm: number;
  volume: number;
}

export interface Rendered {
  blob: Blob;
  filename: string;
}

export type ProgressFn = (fraction: number) => void;

const mp3Blob = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: 'audio/mpeg' });

/** Strip the extension so output names stay readable. */
function baseName(filename: string): string {
  return filename.replace(/\.[^./\\]+$/, '') || 'track';
}

/**
 * Decode a file down to a short preview slice, releasing the full decode.
 * Call once per uploaded file; the result is cheap to re-render repeatedly.
 */
export async function decodePreviewSlice(file: File): Promise<AudioBuffer> {
  const decoded = await decodeAudioFile(file);
  return sliceSeconds(decoded, PREVIEW_SECONDS);
}

/** Render the short audition clip. Fast enough to run on every settings change. */
export async function renderPreview(preview: AudioBuffer, settings: MixSettings): Promise<Blob> {
  const click = await loadClick();
  const mixed = await renderWithMetronome(preview, click, settings);
  return mp3Blob(await encodeToMp3(mixed));
}

/**
 * Render every file at full length and package the result.
 *
 * Files are handled strictly one at a time — decode, mix, encode, release —
 * because holding five decoded tracks at once is hundreds of megabytes and will
 * exhaust the tab on mobile. Only the encoded MP3s (a few MB each) accumulate.
 */
export async function renderDownload(
  files: File[],
  settings: MixSettings,
  merge: boolean,
  onProgress?: ProgressFn,
): Promise<Rendered> {
  if (files.length === 0) throw new Error('No files to process');

  const click = await loadClick();
  const share = 1 / files.length;
  // Rendering is opaque (no progress events), encoding reports continuously.
  const RENDER_SHARE = 0.4;

  const report = (index: number, within: number) => onProgress?.((index + within) * share);

  if (merge) {
    let session: Mp3Session | null = null;
    try {
      for (const [index, file] of files.entries()) {
        const decoded = await decodeAudioFile(file);
        const mixed = await renderWithMetronome(decoded, click, settings);
        report(index, RENDER_SHARE);

        // One encoder across all tracks keeps the bitrate and frame alignment
        // consistent, so the joins are seamless.
        session ??= await Mp3Session.create(mixed.numberOfChannels >= 2 ? 2 : 1);
        await session.push(mixed, (f) => report(index, RENDER_SHARE + f * (1 - RENDER_SHARE)));
      }

      const bytes = await session!.finish();
      onProgress?.(1);
      return {
        blob: mp3Blob(bytes),
        filename: `run-tempo-merged-${settings.bpm}bpm.mp3`,
      };
    } finally {
      session?.dispose();
    }
  }

  const entries: { name: string; data: Uint8Array }[] = [];
  for (const [index, file] of files.entries()) {
    const decoded = await decodeAudioFile(file);
    const mixed = await renderWithMetronome(decoded, click, settings);
    report(index, RENDER_SHARE);

    const bytes = await encodeToMp3(mixed, (f) =>
      report(index, RENDER_SHARE + f * (1 - RENDER_SHARE)),
    );
    entries.push({ name: `${baseName(file.name)}-${settings.bpm}bpm.mp3`, data: bytes });
  }
  onProgress?.(1);

  if (entries.length === 1) {
    return { blob: mp3Blob(entries[0].data), filename: entries[0].name };
  }
  return {
    blob: new Blob([zipFiles(entries) as BlobPart], { type: 'application/zip' }),
    filename: `run-tempo-${settings.bpm}bpm.zip`,
  };
}
