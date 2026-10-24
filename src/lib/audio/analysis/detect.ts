import { ANALYSIS_DECIMATION, ANALYSIS_SAMPLE_RATE } from '../constants';
import { decimate } from './decimate';
import { bpmFromBeats, foldToCanonical, intervalSpread } from './octave';
import { onsetEnvelope, strengthAt, type OnsetEnvelope } from './onset';
import { smoothBeats } from './smooth';
import { estimateTempo } from './tempo';
import { trackBeats } from './track';

export interface BeatAnalysis {
  /** Tempo implied by the tracked beats, folded into the canonical band. */
  bpm: number;
  /** Beat onsets in seconds on the original timeline, ascending. */
  beats: number[];
  /**
   * How periodic the track is at the detected period: a correlation
   * coefficient, where unrhythmic noise sits near zero.
   *
   * Explicitly *not* the onset energy found on the beat path. A dynamic
   * programme run over white noise lands on high-flux frames every time,
   * because high-flux frames are everywhere, so that measure reports high
   * confidence on material with no beat at all.
   */
  confidence: number;
  /** Mean onset energy on the beats, in standard deviations. Diagnostic. */
  beatStrength: number;
  /**
   * Mean onset energy on the midpoints between beats, same units.
   *
   * When this rivals `confidence` the track carries as much event energy
   * between the beats as on them — eighth-note hats, or a half-tempo reading.
   * Reported rather than acted on: ratio choice already covers both readings,
   * and the UI can say "x2 will feel natural here".
   */
  subdivisionStrength: number;
  /** Spread of beat intervals. Near zero is metronomic; higher means drift. */
  drift: number;
}

export type AnalysisStage = 'decimating' | 'onsets' | 'tempo' | 'tracking';
export type AnalysisProgress = (stage: AnalysisStage, fraction: number) => void;

/**
 * Usability thresholds, set from measurements rather than taste.
 *
 * Two independent checks, because neither alone is sufficient. Measured over
 * the generated test tracks (`scripts/make-test-audio.mjs`) and a set of
 * negatives, all at 44.1kHz:
 *
 *   case                       periodicity   beatStrength   verdict
 *   slow 85                          0.288           5.00   accept
 *   late first beat 120              0.259           4.30   accept
 *   steady 128                       0.245           4.17   accept
 *   fast 174                         0.229           3.38   accept
 *   drifting 124->136                0.153           4.04   accept
 *   irregular bursts                 0.110           5.64   reject (periodicity)
 *   white noise                      0.065           1.98   reject (both)
 *   speech-like modulated noise      0.610           2.58   reject (strength)
 *   sustained tone                   0.961           1.82   reject (strength)
 *
 * Each check catches what the other misses. The sustained tone and the
 * speech-like noise are *more* self-correlated than real music — a signal with
 * few onsets has a near-constant envelope, and normalising it to unit variance
 * amplifies ripple into something highly periodic — so periodicity alone
 * accepts them. The irregular bursts have more onset energy than any of the
 * music, so strength alone accepts them.
 *
 * The margins are modest, roughly 10% on each side, and these are synthetic.
 * Where the two errors are not equally bad, the thresholds lean towards
 * accepting: this app is given songs, and wrongly falling back to a fixed grid
 * costs exactly the alignment the feature exists to provide. A wrong decision
 * is also visible — the panel says whether the click is beat-locked — and
 * recoverable with the nudge and snap controls.
 *
 * An earlier calibration drawn from drums-only synthetics (which score 0.34 to
 * 0.98) put periodicity at 0.15, which the drifting track cleared by 0.003.
 * If real tracks turn out to be misclassified, the fix is a better feature
 * rather than more threshold nudging: the peak-to-average ratio of the
 * autocorrelation separates "has a tempo" from "has energy" far more sharply
 * than its absolute height does.
 */
export const MIN_PERIODICITY = 0.12;
export const MIN_BEAT_STRENGTH = 3.0;

export interface DetectOptions {
  /** Rate of the incoming mono signal. */
  sampleRate?: number;
  onProgress?: AnalysisProgress;
}

/**
 * Find a song's tempo and the position of every one of its beats.
 *
 * Runs in four stages: decimate to a quarter rate, build a spectral-flux onset
 * envelope, estimate the beat period by autocorrelation, then fit a beat path
 * to the envelope by dynamic programming. The last stage is what produces
 * per-beat timestamps rather than a single BPM number, and therefore what lets
 * clicks follow a song whose tempo moves.
 */
export function detectBeats(
  mono: Float32Array,
  { sampleRate = ANALYSIS_SAMPLE_RATE * ANALYSIS_DECIMATION, onProgress }: DetectOptions = {},
): BeatAnalysis | null {
  onProgress?.('decimating', 0);
  const factor = Math.max(1, Math.round(sampleRate / ANALYSIS_SAMPLE_RATE));
  const signal = decimate(mono, factor);
  const analysisRate = sampleRate / factor;
  onProgress?.('decimating', 1);

  onProgress?.('onsets', 0);
  const envelope = onsetEnvelope(signal, analysisRate);
  onProgress?.('onsets', 1);
  if (envelope.strength.length === 0) return null;

  onProgress?.('tempo', 0);
  const tempo = estimateTempo(envelope);
  onProgress?.('tempo', 1);
  if (!tempo) return null;

  onProgress?.('tracking', 0);
  const tracked = trackBeats(envelope, { periodFrames: tempo.periodFrames });
  onProgress?.('tracking', 1);
  if (tracked.length < 2) return null;

  // Confidence is measured against the beats the tracker actually chose, but
  // the beats handed on are smoothed: the clicks should follow the song's
  // tempo, not the few milliseconds of noise in each individual estimate.
  const analysis = summarize(tracked, envelope, tempo.periodicity);
  return { ...analysis, beats: smoothBeats(tracked) };
}

/** Derive the reported figures from a tracked beat list. */
export function summarize(
  beats: number[],
  envelope: OnsetEnvelope,
  periodicity: number,
): BeatAnalysis {
  const midpoints: number[] = [];
  for (let i = 1; i < beats.length; i++) midpoints.push((beats[i - 1] + beats[i]) / 2);

  // Tempo from the beats themselves, not from the autocorrelation estimate:
  // the DP path is free to depart from the estimate, and on a drifting track
  // it should. The median gap is what the clicks will actually sound like.
  const tracked = bpmFromBeats(beats);
  const fold = foldToCanonical(tracked);

  return {
    bpm: fold.bpm,
    beats,
    confidence: periodicity,
    beatStrength: strengthAt(envelope, beats),
    subdivisionStrength: strengthAt(envelope, midpoints),
    drift: intervalSpread(beats),
  };
}

/**
 * True when the analysis is solid enough to place clicks from.
 *
 * When this is false the caller falls back to a fixed grid. That is a real
 * downgrade, but a click in a confidently wrong phase is worse than one the
 * user can see is merely approximate.
 *
 * Deliberately a plain predicate rather than a type guard: a low-confidence
 * result is still a BeatAnalysis, and the caller still wants its BPM to show
 * the user. Narrowing it away on the false branch would be a lie.
 */
export const isUsable = (analysis: BeatAnalysis | null): boolean =>
  analysis !== null &&
  analysis.beats.length >= 2 &&
  analysis.confidence >= MIN_PERIODICITY &&
  analysis.beatStrength >= MIN_BEAT_STRENGTH;
