import { AnalysisEngine, type StageFn } from './analysis/client';
import { fileKey, readAnalysis, writeAnalysis } from './analysis/cache';
import type { BeatAnalysis } from './analysis/detect';
import { toMono } from './analysis/downmix';
import { loadClick } from './click';
import { PREVIEW_SECONDS, SAMPLE_RATE } from './constants';
import { decodeAudioFile } from './decode';
import { Mp3Session, encodeToMp3 } from './encode';
import { planClicks, planMix, type MixPlan, type MixSettings } from './plan';
import { renderWithMetronome } from './render';
import { sliceSeconds } from './slice';
import { zipFiles } from './zip';

export type { MixSettings, MixPlan } from './plan';

export interface Rendered {
  blob: Blob;
  filename: string;
}

export type ProgressFn = (fraction: number) => void;
export type PhaseFn = (phase: string, fraction: number) => void;

const mp3Blob = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: 'audio/mpeg' });

/** Strip the extension so output names stay readable. */
function baseName(filename: string): string {
  return filename.replace(/\.[^./\\]+$/, '') || 'track';
}

/** One engine per module: starting a Worker per track would be wasteful. */
let engine: AnalysisEngine | null = null;
const sharedEngine = () => (engine ??= new AnalysisEngine());

export interface PreparedTrack {
  file: File;
  /** A short slice for auditioning, at the original tempo. */
  preview: AudioBuffer;
  /** Null until analysis has run, or when it failed. */
  analysis: BeatAnalysis | null;
  /** Content hash, used to cache the analysis. */
  key: string;
}

/**
 * Analyse an already-decoded buffer, consulting the cache first.
 *
 * Takes a decoded buffer rather than a File so the download path can decode
 * once and use that same decode for both analysis and rendering. Decoding a
 * four-minute MP3 is around a second of work and an 84MB allocation; doing it
 * twice per file was pure waste.
 */
async function analyseBuffer(
  decoded: AudioBuffer,
  key: string,
  onStage?: StageFn,
): Promise<BeatAnalysis | null> {
  const cached = await readAnalysis(key);
  if (cached) return cached;

  // Transferred to the worker, so this 42MB is moved rather than copied.
  const analysis = await sharedEngine().analyse(toMono(decoded), decoded.sampleRate, onStage);
  if (analysis) await writeAnalysis(key, analysis);
  return analysis;
}

/**
 * Decode a file to a preview slice and analyse its beats.
 *
 * Analysis is lazy — this runs when the user first asks to hear or download a
 * mix, not on upload — but it is cached by content hash, so the second ask is
 * instant and so is a later download of a track already auditioned.
 */
export async function prepareTrack(file: File, onStage?: StageFn): Promise<PreparedTrack> {
  const key = await fileKey(file);
  const decoded = await decodeAudioFile(file);
  const preview = sliceSeconds(decoded, PREVIEW_SECONDS);
  const analysis = await analyseBuffer(decoded, key, onStage);
  return { file, preview, analysis, key };
}

/** Everything needed to render, resolved from a track and the user's settings. */
export function resolvePlan(track: PreparedTrack, settings: MixSettings): MixPlan {
  return planMix(track.analysis, settings);
}

/**
 * Stretch an AudioBuffer, returning it unchanged when no stretch is needed.
 *
 * Returns plain channel arrays rather than an AudioBuffer so the worker can
 * transfer them; the caller rebuilds a buffer only when it needs one.
 */
async function stretchBuffer(
  buffer: AudioBuffer,
  playbackRate: number,
  onStage?: StageFn,
): Promise<AudioBuffer> {
  if (Math.abs(playbackRate - 1) < 1e-9) return buffer;

  // A copy is unavoidable: getChannelData hands back a view onto the
  // AudioBuffer's own storage, which cannot be transferred to a worker. This
  // is the peak of the whole pipeline — the decode plus its copy, around
  // 160MB for a four-minute stereo track — which is why the caller drops the
  // decode immediately after and why files are processed strictly one by one.
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(Float32Array.from(buffer.getChannelData(c)));
  }

  // playbackRate is a rate; the stretcher takes a duration multiplier. The
  // arrays are transferred, so the main thread is left holding neither copy
  // while the worker runs.
  const stretched = await sharedEngine().stretch(channels, 1 / playbackRate, onStage);

  const out = new AudioBuffer({
    length: stretched[0].length,
    numberOfChannels: stretched.length,
    sampleRate: SAMPLE_RATE,
  });
  stretched.forEach((data, index) => out.copyToChannel(data, index));
  return out;
}

/**
 * Render every file at full length and package the result.
 *
 * Files are handled strictly one at a time — decode, analyse, stretch, mix,
 * encode, release — because holding five decoded tracks at once is hundreds of
 * megabytes and will exhaust the tab on mobile. Only the encoded MP3s (a few
 * MB each) accumulate.
 */
export async function renderDownload(
  files: File[],
  settings: MixSettings,
  merge: boolean,
  onProgress?: ProgressFn,
  onPhase?: PhaseFn,
): Promise<Rendered> {
  if (files.length === 0) throw new Error('No files to process');

  const click = await loadClick();
  const share = 1 / files.length;

  // Rough split of each file's share between the stages that can report.
  const ANALYSE_SHARE = 0.3;
  const STRETCH_SHARE = 0.25;
  const RENDER_SHARE = 0.1;

  const report = (index: number, within: number) => onProgress?.((index + within) * share);

  const prepare = async (file: File, index: number) => {
    const key = await fileKey(file);
    // One decode, used for both analysis and rendering.
    const decoded = await decodeAudioFile(file);

    const analysis = await analyseBuffer(decoded, key, (stage, fraction) => {
      onPhase?.(stage, fraction);
      report(index, fraction * ANALYSE_SHARE);
    });
    const plan = planMix(analysis, settings);

    const music = await stretchBuffer(decoded, plan.playbackRate, (stage, fraction) => {
      onPhase?.(stage, fraction);
      report(index, ANALYSE_SHARE + fraction * STRETCH_SHARE);
    });

    const clicks = planClicks(plan, analysis, settings, music.duration);
    const mixed = await renderWithMetronome(music, click, { clicks, volume: settings.volume });
    report(index, ANALYSE_SHARE + STRETCH_SHARE + RENDER_SHARE);
    return mixed;
  };

  const encodeShare = 1 - ANALYSE_SHARE - STRETCH_SHARE - RENDER_SHARE;
  const encodeProgress = (index: number) => (fraction: number) => {
    onPhase?.('encoding', fraction);
    report(index, ANALYSE_SHARE + STRETCH_SHARE + RENDER_SHARE + fraction * encodeShare);
  };

  if (merge) {
    let session: Mp3Session | null = null;
    try {
      for (const [index, file] of files.entries()) {
        const mixed = await prepare(file, index);
        // One encoder across all tracks keeps the bitrate and frame alignment
        // consistent, so the joins are seamless.
        session ??= await Mp3Session.create(mixed.numberOfChannels >= 2 ? 2 : 1);
        await session.push(mixed, encodeProgress(index));
      }

      const bytes = await session!.finish();
      onProgress?.(1);
      return { blob: mp3Blob(bytes), filename: `run-tempo-merged-${settings.bpm}bpm.mp3` };
    } finally {
      session?.dispose();
    }
  }

  const entries: { name: string; data: Uint8Array }[] = [];
  for (const [index, file] of files.entries()) {
    const mixed = await prepare(file, index);
    const bytes = await encodeToMp3(mixed, encodeProgress(index));
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
