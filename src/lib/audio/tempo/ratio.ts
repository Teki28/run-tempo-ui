import { CLICK_RATIOS, DEFAULT_MAX_STRETCH_PCT } from '../constants';

/** What the chosen ratio does to the music and where the click ends up. */
export type RatioOutcome =
  /** The target was hit with no stretching at all. */
  | 'exact'
  /** The target was hit by stretching within the allowed limit. */
  | 'stretched'
  /** The stretch limit stopped us short; `residualBpm` is what's left. */
  | 'clamped';

export interface RatioChoice {
  /** Clicks per detected beat. 2 means a click on every half-beat. */
  ratio: number;
  /** `songBpm * ratio` — the click rate before any stretching. */
  naturalBpm: number;
  targetBpm: number;
  songBpm: number;
  /** Rate the music is played at. <1 slows it down, >1 speeds it up. */
  playbackRate: number;
  /** Signed tempo change for display. -8 means "played 8% slower". */
  stretchPct: number;
  /** Click rate actually delivered, after stretching. */
  effectiveBpm: number;
  /** `targetBpm - effectiveBpm`. Zero unless the stretch limit bit. */
  residualBpm: number;
  outcome: RatioOutcome;
}

export interface RatioOptions {
  /** Allowed ratios, as multiples of the song's own beat rate. */
  ratios?: readonly number[];
  /** Largest tempo change permitted, as a percentage. */
  maxStretchPct?: number;
}

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

/**
 * Evaluate one ratio under the stretch limit.
 *
 * Note this clamps *before* scoring rather than after choosing. Picking the
 * ratio whose natural BPM is nearest the target and only then clamping can pick
 * a worse ratio: the comparison that matters is between what each ratio can
 * actually deliver once the limit is applied, not where it starts.
 */
function evaluate(
  songBpm: number,
  targetBpm: number,
  ratio: number,
  maxStretchPct: number,
): RatioChoice {
  const naturalBpm = songBpm * ratio;
  const limit = maxStretchPct / 100;
  const idealRate = targetBpm / naturalBpm;
  const playbackRate = clamp(idealRate, 1 - limit, 1 + limit);
  const effectiveBpm = naturalBpm * playbackRate;

  // Compare rates, not BPM: a float-exact target lands on rate 1 and must not
  // be reported as a 0.0000001% stretch.
  const clamped = Math.abs(playbackRate - idealRate) > 1e-12;
  const outcome: RatioOutcome = clamped
    ? 'clamped'
    : Math.abs(playbackRate - 1) < 1e-12
      ? 'exact'
      : 'stretched';

  return {
    ratio,
    naturalBpm,
    targetBpm,
    songBpm,
    playbackRate,
    stretchPct: (playbackRate - 1) * 100,
    effectiveBpm,
    residualBpm: targetBpm - effectiveBpm,
    outcome,
  };
}

/**
 * Choose which multiple of the song's own tempo to click on.
 *
 * The runner's cadence is the target; the song's beat grid is what we have to
 * work with. An 85 BPM song against a 170 target needs a click every half-beat
 * and no stretching at all — that case should come out `exact`, because
 * stretching a song that already lines up would be pure damage.
 */
export function chooseRatio(
  songBpm: number,
  targetBpm: number,
  { ratios = CLICK_RATIOS, maxStretchPct = DEFAULT_MAX_STRETCH_PCT }: RatioOptions = {},
): RatioChoice {
  if (!Number.isFinite(songBpm) || songBpm <= 0) {
    throw new RangeError(`songBpm must be a positive number, got ${songBpm}`);
  }
  if (!Number.isFinite(targetBpm) || targetBpm <= 0) {
    throw new RangeError(`targetBpm must be a positive number, got ${targetBpm}`);
  }
  if (ratios.length === 0) throw new RangeError('ratios must not be empty');
  if (maxStretchPct < 0) {
    throw new RangeError(`maxStretchPct must not be negative, got ${maxStretchPct}`);
  }

  const candidates = ratios.map((ratio) => evaluate(songBpm, targetBpm, ratio, maxStretchPct));

  return candidates.reduce((best, candidate) => {
    const byResidual = Math.abs(candidate.residualBpm) - Math.abs(best.residualBpm);
    // 0.01 BPM is far below audible; past that, prefer the musically gentler
    // option — the ratio nearest 1, then the smaller stretch.
    if (Math.abs(byResidual) > 0.01) return byResidual < 0 ? candidate : best;

    const byOctave =
      Math.abs(Math.log2(candidate.ratio)) - Math.abs(Math.log2(best.ratio));
    if (Math.abs(byOctave) > 1e-9) return byOctave < 0 ? candidate : best;

    return Math.abs(candidate.stretchPct) < Math.abs(best.stretchPct) ? candidate : best;
  });
}

/** The slowest and fastest click a given song can be made to produce. */
export interface ReachableRange {
  minBpm: number;
  maxBpm: number;
}

/**
 * The band of cadences a song can actually deliver.
 *
 * The click is always `songBpm * ratio * playbackRate`, so the extremes fall
 * out of the smallest and largest allowed ratio at the full stretch limit.
 * The UI shows this on the BPM slider: the slider offers 30-300 for every
 * song, but an 80 BPM track can only reach 37-346, and the user should not
 * have to press play to find that out.
 */
export function reachableRange(
  songBpm: number,
  { ratios = CLICK_RATIOS, maxStretchPct = DEFAULT_MAX_STRETCH_PCT }: RatioOptions = {},
): ReachableRange {
  if (!Number.isFinite(songBpm) || songBpm <= 0) {
    throw new RangeError(`songBpm must be a positive number, got ${songBpm}`);
  }
  if (ratios.length === 0) throw new RangeError('ratios must not be empty');
  if (maxStretchPct < 0) {
    throw new RangeError(`maxStretchPct must not be negative, got ${maxStretchPct}`);
  }

  const limit = maxStretchPct / 100;
  return {
    minBpm: songBpm * Math.min(...ratios) * (1 - limit),
    maxBpm: songBpm * Math.max(...ratios) * (1 + limit),
  };
}

/**
 * The "leave my song alone" fallback offered when the gap is too wide: click on
 * the song's own cadence at the chosen ratio, with no stretching.
 */
export function snapToSong(choice: RatioChoice): RatioChoice {
  return {
    ...choice,
    playbackRate: 1,
    stretchPct: 0,
    effectiveBpm: choice.naturalBpm,
    residualBpm: choice.targetBpm - choice.naturalBpm,
    outcome: 'exact',
  };
}

/** True when the stretch limit stopped us reaching the target cadence. */
export const needsSnapOffer = (choice: RatioChoice): boolean => choice.outcome === 'clamped';
