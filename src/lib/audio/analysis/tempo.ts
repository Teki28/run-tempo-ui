import { MAX_DETECT_BPM, MIN_DETECT_BPM } from '../constants';
import type { OnsetEnvelope } from './onset';

export interface TempoCandidate {
  bpm: number;
  /** Prior-weighted autocorrelation score. Comparable within one estimate. */
  score: number;
  /** Beat period in envelope frames. */
  periodFrames: number;
  /**
   * Raw autocorrelation at this lag, before the prior.
   *
   * The envelope arrives with zero mean and unit variance, so this is already
   * a correlation coefficient: how periodic the track actually is at this
   * period, on a scale where noise sits near zero. This — not how much onset
   * energy the beat path managed to find — is the honest confidence signal.
   * A dynamic programme run over white noise will always land on high-flux
   * frames, because high-flux frames are everywhere.
   */
  periodicity: number;
}

export interface TempoEstimate extends TempoCandidate {
  /** Every local peak considered, strongest first. Used for octave analysis. */
  candidates: TempoCandidate[];
}

export interface TempoOptions {
  minBpm?: number;
  maxBpm?: number;
  /** Centre of the tempo prior, in BPM. */
  priorCentreBpm?: number;
  /** Width of the prior, in octaves. */
  priorOctaves?: number;
}

/**
 * Log-normal preference over tempo, centred on where music actually sits.
 *
 * Autocorrelation cannot distinguish a tempo from its own double or half: both
 * are real periodicities in the signal. Something has to break the tie, and a
 * broad prior around 120 BPM is the standard choice — it is the assumption
 * that a track is more likely 128 than 64 or 256, without being so sharp that
 * a genuine 170 BPM song gets dragged down.
 */
const priorWeight = (bpm: number, centre: number, octaves: number): number =>
  Math.exp(-0.5 * (Math.log2(bpm / centre) / octaves) ** 2);

/**
 * Estimate the song's beat period from its onset envelope.
 *
 * Plain autocorrelation over the plausible lag range, weighted by the prior.
 * Deliberately not a comb filter summing harmonics: that reinforces the
 * slowest candidate, which is the wrong bias for dance music where the
 * strongest periodicity genuinely is the beat.
 */
export function estimateTempo(
  envelope: OnsetEnvelope,
  {
    minBpm = MIN_DETECT_BPM,
    maxBpm = MAX_DETECT_BPM,
    priorCentreBpm = 120,
    priorOctaves = 1,
  }: TempoOptions = {},
): TempoEstimate | null {
  if (minBpm <= 0 || maxBpm <= minBpm) {
    throw new RangeError(`invalid tempo range ${minBpm}-${maxBpm}`);
  }

  const { strength, frameRate } = envelope;
  const n = strength.length;
  const minLag = Math.max(2, Math.floor((60 * frameRate) / maxBpm));
  const maxLag = Math.ceil((60 * frameRate) / minBpm);
  if (n < minLag * 4) return null;

  const limit = Math.min(maxLag, n - 1);
  const scores = new Float64Array(limit + 1);
  const correlation = new Float64Array(limit + 1);

  for (let lag = minLag; lag <= limit; lag++) {
    let acc = 0;
    const count = n - lag;
    for (let i = 0; i < count; i++) acc += strength[i] * strength[i + lag];
    // Divide by the overlap so long lags are not penalised for comparing
    // fewer samples.
    const bpm = (60 * frameRate) / lag;
    correlation[lag] = acc / count;
    scores[lag] = correlation[lag] * priorWeight(bpm, priorCentreBpm, priorOctaves);
  }

  const candidates: TempoCandidate[] = [];
  for (let lag = minLag + 1; lag < limit; lag++) {
    if (scores[lag] > scores[lag - 1] && scores[lag] >= scores[lag + 1]) {
      candidates.push({
        bpm: (60 * frameRate) / lag,
        score: scores[lag],
        periodFrames: lag,
        periodicity: correlation[lag],
      });
    }
  }
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  const best = refine(candidates[0], scores, frameRate);
  return { ...best, candidates };
}

/**
 * Parabolic interpolation around the winning lag.
 *
 * The lag grid is one envelope frame wide — 11.6ms, which at 170 BPM is most
 * of a BPM. Fitting a parabola to the peak and its neighbours recovers the
 * sub-frame maximum, so the reported tempo is not quantised to whatever the
 * hop size happened to be.
 */
function refine(
  candidate: TempoCandidate,
  scores: Float64Array,
  frameRate: number,
): TempoCandidate {
  const lag = candidate.periodFrames;
  const prev = scores[lag - 1];
  const next = scores[lag + 1];
  if (!Number.isFinite(prev) || !Number.isFinite(next)) return candidate;

  const denominator = prev - 2 * candidate.score + next;
  if (denominator === 0) return candidate;

  const shift = (0.5 * (prev - next)) / denominator;
  if (!Number.isFinite(shift) || Math.abs(shift) > 1) return candidate;

  const periodFrames = lag + shift;
  return { ...candidate, periodFrames, bpm: (60 * frameRate) / periodFrames };
}
