import { ANALYSIS_SAMPLE_RATE, ONSET_FRAME_SIZE, ONSET_HOP_SIZE } from '../constants';
import { FftPlan, hannWindow } from './fft';

export interface OnsetEnvelope {
  /** Onset strength per frame, mean-removed and scaled to unit deviation. */
  strength: Float32Array;
  /** Frames per second — the time resolution of everything downstream. */
  frameRate: number;
  /**
   * Seconds from a frame's nominal start to the instant it represents.
   *
   * Frames are timestamped at their window centre, not their first sample.
   * Spectral flux registers an onset as soon as it enters the analysis window,
   * so timestamping by window start reports every onset early by most of a
   * window — 82ms at a 1024-sample frame, measured against a known impulse.
   * Centring cuts that to 0.7ms at the 256-sample frame actually used.
   */
  frameOffsetSec: number;
}

/**
 * Noise floor inside the log.
 *
 * `log(mag + eps)` rather than `log1p(mag)`: the difference of two logs is
 * scale-invariant, so the same snare gives the same flux in a quiet verse and
 * a loud chorus. log1p is not — it compresses small magnitudes differently
 * from large ones, and the envelope ends up following the mastering rather
 * than the drummer.
 */
const LOG_EPS = 1e-6;

/** Wall-clock time of an envelope frame. */
export const frameToSeconds = (frame: number, envelope: OnsetEnvelope): number =>
  frame / envelope.frameRate + envelope.frameOffsetSec;

/** Envelope frame nearest a wall-clock time. */
export const secondsToFrame = (seconds: number, envelope: OnsetEnvelope): number =>
  (seconds - envelope.frameOffsetSec) * envelope.frameRate;

/**
 * Spectral-flux onset strength.
 *
 * For each STFT frame, sum how much every bin's log-magnitude *rose* since the
 * previous frame. Rises only: a cymbal decaying is not an onset, and counting
 * the fall would put a spurious bump halfway between every pair of real hits.
 */
export function onsetEnvelope(
  signal: Float32Array,
  sampleRate: number = ANALYSIS_SAMPLE_RATE,
  frameSize: number = ONSET_FRAME_SIZE,
  hopSize: number = ONSET_HOP_SIZE,
): OnsetEnvelope {
  if (hopSize < 1 || frameSize < 2) {
    throw new RangeError(`invalid STFT geometry ${frameSize}/${hopSize}`);
  }

  const frameRate = sampleRate / hopSize;
  const frameOffsetSec = frameSize / 2 / sampleRate;
  const frames =
    signal.length >= frameSize ? 1 + Math.floor((signal.length - frameSize) / hopSize) : 0;
  if (frames <= 0) {
    return { strength: new Float32Array(0), frameRate, frameOffsetSec };
  }

  const plan = new FftPlan(frameSize);
  const window = hannWindow(frameSize);
  const bins = frameSize >> 1;

  // Scale to unit peak so detection is level-invariant by construction.
  // Relying on the log's own scale invariance is not enough: it only holds
  // where magnitude dominates LOG_EPS, which fails in decay tails and
  // near-silence, and shrinking LOG_EPS instead would amplify noise. Folded
  // into the window gain below, so it costs one pass and no allocation.
  let peak = 0;
  for (let i = 0; i < signal.length; i++) {
    const a = Math.abs(signal[i]);
    if (a > peak) peak = a;
  }
  const gain = peak > 0 ? 1 / peak : 1;

  const strength = new Float32Array(frames);
  const re = new Float32Array(frameSize);
  const im = new Float32Array(frameSize);
  let previous = new Float32Array(bins).fill(Math.log(LOG_EPS));
  let current = new Float32Array(bins);

  for (let f = 0; f < frames; f++) {
    const start = f * hopSize;
    for (let i = 0; i < frameSize; i++) re[i] = signal[start + i] * window[i] * gain;
    im.fill(0);
    plan.transform(re, im);

    let flux = 0;
    for (let k = 0; k < bins; k++) {
      const mag = Math.log(Math.hypot(re[k], im[k]) + LOG_EPS);
      current[k] = mag;
      const rise = mag - previous[k];
      if (rise > 0) flux += rise;
    }
    strength[f] = flux;

    const swap = previous;
    previous = current;
    current = swap;
  }

  // Frame 0's predecessor is the synthetic silence floor, so its "rise" is the
  // entire spectrum appearing at once. Left in, it is the largest value in the
  // envelope and drags the tracker's phase towards t=0 — the exact bias this
  // whole exercise exists to remove.
  if (frames > 1) strength[0] = strength[1];

  return { strength: normalize(strength), frameRate, frameOffsetSec };
}

/**
 * Centre on zero and scale to unit standard deviation.
 *
 * The DP tracker weighs onset strength against a tempo penalty using a fixed
 * constant, so the envelope has to arrive on a predictable scale regardless of
 * how the track was mastered.
 */
function normalize(strength: Float32Array): Float32Array {
  const n = strength.length;
  if (n === 0) return strength;

  let mean = 0;
  for (let i = 0; i < n; i++) mean += strength[i];
  mean /= n;

  let variance = 0;
  for (let i = 0; i < n; i++) {
    const d = strength[i] - mean;
    variance += d * d;
  }
  const deviation = Math.sqrt(variance / n) || 1;

  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (strength[i] - mean) / deviation;
  return out;
}

/** Mean envelope value at the given times, for comparing candidate grids. */
export function strengthAt(envelope: OnsetEnvelope, times: readonly number[]): number {
  if (times.length === 0) return 0;
  const { strength } = envelope;
  let total = 0;
  for (const t of times) {
    const frame = Math.round(secondsToFrame(t, envelope));
    if (frame >= 0 && frame < strength.length) total += strength[frame];
  }
  return total / times.length;
}
