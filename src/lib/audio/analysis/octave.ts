import { CANONICAL_BPM_MAX, CANONICAL_BPM_MIN } from '../constants';

export interface OctaveFold {
  /** The tempo folded into the canonical band. */
  bpm: number;
  /** Power of two applied. 2 means the input was doubled to get there. */
  factor: number;
}

/**
 * Fold an out-of-band tempo into the canonical band by doubling or halving.
 *
 * This fixes readings that are *outside* musical plausibility — a tracker
 * reporting 240 or 40 — and nothing more. It deliberately cannot resolve an
 * in-band octave error: 87 and 174 are both inside the band and both
 * plausible, so there is no basis here for preferring either. Deciding that
 * needs the onset envelope (does the midpoint between beats carry energy
 * too?), which only the detector has.
 *
 * Which is survivable, because ratio choice absorbs it: clicks for x2 of 87
 * and x1 of 174 land in exactly the same places. The octave matters for the
 * BPM shown to the user, not for where the click goes.
 */
export function foldToCanonical(
  bpm: number,
  min: number = CANONICAL_BPM_MIN,
  max: number = CANONICAL_BPM_MAX,
): OctaveFold {
  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new RangeError(`bpm must be a positive number, got ${bpm}`);
  }
  if (!(min > 0) || !(max > min)) {
    throw new RangeError(`invalid band ${min}-${max}`);
  }

  let folded = bpm;
  let factor = 1;

  // The band is narrower than an octave for some inputs, so cap the walk and
  // keep whichever end we reached rather than oscillating.
  for (let i = 0; folded < min && i < 8; i++) {
    folded *= 2;
    factor *= 2;
  }
  for (let i = 0; folded > max && i < 8; i++) {
    folded /= 2;
    factor /= 2;
  }
  return { bpm: folded, factor };
}

/** Median of the gaps between consecutive beats. */
export function medianInterval(beats: readonly number[]): number {
  if (beats.length < 2) return Number.NaN;
  const gaps: number[] = [];
  for (let i = 1; i < beats.length; i++) gaps.push(beats[i] - beats[i - 1]);
  gaps.sort((a, b) => a - b);
  const mid = gaps.length >> 1;
  return gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
}

/** Gaps further than this from the median are treated as tracking slips. */
const OUTLIER_TOLERANCE = 0.35;

/**
 * Tempo implied by a beat list: a trimmed mean of the beat intervals.
 *
 * Neither a plain median nor a plain mean will do. Beat times are quantised to
 * the envelope's 11.6ms frame grid, so any single interval is wrong by up to
 * half a frame — at 128 BPM the median gap lands on either 40 or 41 frames,
 * which is 132.3 or 129.1 BPM and never 128. Averaging many intervals cancels
 * that down to a fraction of a BPM. But a plain mean is wrecked by a tracker
 * that drops a beat, leaving one interval at double length, so the median is
 * still used first — to decide which intervals to average.
 */
export function bpmFromBeats(beats: readonly number[]): number {
  const median = medianInterval(beats);
  if (!Number.isFinite(median) || median <= 0) return Number.NaN;

  let total = 0;
  let count = 0;
  for (let i = 1; i < beats.length; i++) {
    const gap = beats[i] - beats[i - 1];
    if (Math.abs(gap - median) <= median * OUTLIER_TOLERANCE) {
      total += gap;
      count++;
    }
  }
  const interval = count > 0 ? total / count : median;
  return interval > 0 ? 60 / interval : Number.NaN;
}

/** How steady the beat list is: 0 is metronomic, higher means more drift. */
export function intervalSpread(beats: readonly number[]): number {
  const median = medianInterval(beats);
  if (!Number.isFinite(median) || median <= 0) return Number.NaN;
  let total = 0;
  for (let i = 1; i < beats.length; i++) {
    total += Math.abs(beats[i] - beats[i - 1] - median);
  }
  return total / ((beats.length - 1) * median);
}
