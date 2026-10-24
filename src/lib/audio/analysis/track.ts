import { frameToSeconds, type OnsetEnvelope } from './onset';

export interface TrackOptions {
  /** Expected beat period in envelope frames, from tempo estimation. */
  periodFrames: number;
  /**
   * How firmly the tracker is held to the expected period. Higher values
   * follow the estimate through weak passages; lower values let the beat
   * follow the audio, including genuine tempo drift.
   */
  tightness?: number;
}

/** Default chosen to follow real tempo drift without chasing syncopation. */
const DEFAULT_TIGHTNESS = 100;

/**
 * Find the beat sequence that best explains the onset envelope.
 *
 * Dynamic programming over every frame, after Ellis (2007) — the same
 * formulation behind librosa's `beat_track`. Each frame's score is its own
 * onset strength plus the best score reachable from a predecessor roughly one
 * beat period earlier, minus a penalty growing with the square of the log
 * deviation from that period.
 *
 * Choosing the globally optimal path is what separates this from peak-picking.
 * A missing kick, a syncopated bar or a drum fill cannot knock the grid out of
 * phase, because the path through them is still scored against every
 * alternative; and because the penalty is on the *ratio* of the interval to
 * the expected period rather than its absolute value, a track that accelerates
 * is followed rather than fought.
 */
export function trackBeats(
  envelope: OnsetEnvelope,
  { periodFrames, tightness = DEFAULT_TIGHTNESS }: TrackOptions,
): number[] {
  const { strength } = envelope;
  const n = strength.length;
  const period = periodFrames;
  if (!Number.isFinite(period) || period < 1) {
    throw new RangeError(`periodFrames must be at least 1, got ${periodFrames}`);
  }
  if (n === 0) return [];

  // Search window around one period back. Wide enough to absorb a half-time
  // or double-time bar without letting the path jump an arbitrary distance.
  const minStep = Math.max(1, Math.round(period / 2));
  const maxStep = Math.max(minStep + 1, Math.round(period * 2));

  const score = new Float64Array(n);
  const previous = new Int32Array(n).fill(-1);

  // Precompute the transition penalty per step length: it depends only on the
  // step, and the inner loop would otherwise take a log per frame pair.
  const penalty = new Float64Array(maxStep + 1);
  for (let step = minStep; step <= maxStep; step++) {
    penalty[step] = -tightness * Math.log(step / period) ** 2;
  }

  for (let t = 0; t < n; t++) {
    let bestScore = 0;
    let bestFrom = -1;

    const from = t - maxStep;
    const to = t - minStep;
    for (let tau = Math.max(0, from); tau <= to; tau++) {
      const candidate = score[tau] + penalty[t - tau];
      if (bestFrom === -1 || candidate > bestScore) {
        bestScore = candidate;
        bestFrom = tau;
      }
    }

    // A beat early enough to have no valid predecessor starts a path.
    score[t] = strength[t] + (bestFrom === -1 ? 0 : bestScore);
    previous[t] = bestFrom;
  }

  // Start the backtrace from the best scoring frame in the final stretch,
  // rather than the global maximum: the cumulative score grows along the
  // track, so the global maximum is almost always near the end anyway, but a
  // fade-out can leave the true last beat slightly short of it.
  let tail = -1;
  let tailScore = -Infinity;
  for (let t = Math.max(0, n - maxStep); t < n; t++) {
    if (score[t] > tailScore) {
      tailScore = score[t];
      tail = t;
    }
  }
  if (tail < 0) return [];

  const frames: number[] = [];
  for (let t = tail; t >= 0; t = previous[t]) {
    frames.push(t);
    if (previous[t] < 0) break;
  }
  frames.reverse();

  return frames.map((frame) => frameToSeconds(refine(strength, frame), envelope));
}

/**
 * Nudge a beat to the sub-frame peak of the onset envelope around it.
 *
 * Without this, every beat time is quantised to the envelope hop, and the
 * interval between consecutive clicks inherits that error in both directions —
 * audible as a metronome that does not quite sit still even when the grid is
 * correct on average. Fitting a parabola through the frame and its two
 * neighbours recovers the peak between samples.
 *
 * The shift is clamped to half a frame: beyond that the parabola is not
 * describing this peak any more, which happens when the envelope is flat or
 * the beat fell on a trough the DP chose for its timing rather than its
 * strength.
 */
function refine(strength: Float32Array, frame: number): number {
  if (frame <= 0 || frame >= strength.length - 1) return frame;

  const prev = strength[frame - 1];
  const here = strength[frame];
  const next = strength[frame + 1];

  const denominator = prev - 2 * here + next;
  if (denominator === 0) return frame;

  const shift = (0.5 * (prev - next)) / denominator;
  if (!Number.isFinite(shift) || Math.abs(shift) > 0.5) return frame;
  return frame + shift;
}
