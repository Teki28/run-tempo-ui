import { clickTimes, fallbackClickTimes } from './clicks/schedule';
import { DEFAULT_MAX_STRETCH_PCT } from './constants';
import { isUsable, type BeatAnalysis } from './analysis/detect';
import { chooseRatio, snapToSong, type RatioChoice } from './tempo/ratio';

export interface MixSettings {
  /** The runner's target cadence. */
  bpm: number;
  /** Click loudness as a percentage, 0-500. */
  volume: number;
  /** Manual phase correction in milliseconds. */
  nudgeMs?: number;
  /** Largest tempo change allowed, as a percentage. */
  maxStretchPct?: number;
  /** Ignore the stretch and click on the song's own cadence instead. */
  snap?: boolean;
}

export interface MixPlan {
  /** Null when detection failed and the click is on a fixed grid. */
  choice: RatioChoice | null;
  /** Rate to play the music at. 1 means no stretching. */
  playbackRate: number;
  /** Detected song tempo, or null when unknown. */
  songBpm: number | null;
  /** What the click will actually sound like, in BPM. */
  effectiveBpm: number;
  /** True when the click grid came from the song rather than a BPM number. */
  beatLocked: boolean;
}

/**
 * Decide what to do with a track, before touching any audio.
 *
 * Separated from rendering so the UI can show the user the ratio and stretch
 * it is about to apply — and so this decision is testable without an
 * AudioContext.
 */
export function planMix(analysis: BeatAnalysis | null, settings: MixSettings): MixPlan {
  const { bpm, maxStretchPct = DEFAULT_MAX_STRETCH_PCT, snap = false } = settings;

  if (analysis === null || !isUsable(analysis)) {
    return {
      choice: null,
      playbackRate: 1,
      songBpm: analysis?.bpm ?? null,
      effectiveBpm: bpm,
      beatLocked: false,
    };
  }

  const chosen = chooseRatio(analysis.bpm, bpm, { maxStretchPct });
  const choice = snap ? snapToSong(chosen) : chosen;

  return {
    choice,
    playbackRate: choice.playbackRate,
    songBpm: analysis.bpm,
    effectiveBpm: choice.effectiveBpm,
    beatLocked: true,
  };
}

/**
 * Click onsets for a planned mix, on the timeline of the rendered output.
 *
 * `durationSec` must be the duration *after* stretching, since that is the
 * timeline the clicks land on.
 */
export function planClicks(
  plan: MixPlan,
  analysis: BeatAnalysis | null,
  settings: MixSettings,
  durationSec: number,
): number[] {
  const nudgeMs = settings.nudgeMs ?? 0;

  if (!plan.beatLocked || !analysis || !plan.choice) {
    return fallbackClickTimes(settings.bpm, durationSec, nudgeMs);
  }

  return clickTimes({
    beats: analysis.beats,
    ratio: plan.choice.ratio,
    playbackRate: plan.playbackRate,
    nudgeMs,
    durationSec,
  });
}
