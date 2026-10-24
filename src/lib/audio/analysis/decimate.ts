import { ANALYSIS_DECIMATION } from '../constants';

/**
 * Anti-alias cutoff as a fraction of the *output* Nyquist. 0.88 leaves the
 * filter's transition band inside the octave being discarded rather than
 * letting it fold back; the cutoff in input-rate terms is 0.44/factor.
 */
const CUTOFF_FRACTION = 0.88;
const TAPS = 33;

/** Hamming-windowed sinc lowpass. Linear phase, so it delays every frequency
 *  by the same (TAPS-1)/2 samples — which the caller compensates below. */
function lowpassKernel(cutoff: number, taps: number): Float32Array {
  const kernel = new Float32Array(taps);
  const mid = (taps - 1) / 2;
  let sum = 0;
  for (let i = 0; i < taps; i++) {
    const x = i - mid;
    const sinc = x === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * x) / (Math.PI * x);
    const window = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (taps - 1));
    kernel[i] = sinc * window;
    sum += kernel[i];
  }
  // Normalise to unity DC gain so onset magnitudes stay comparable.
  for (let i = 0; i < taps; i++) kernel[i] /= sum;
  return kernel;
}

/**
 * Lowpass and keep every Nth sample.
 *
 * The filter is not optional. Taking every 4th sample of a 44.1kHz signal
 * without it folds everything above 5.5kHz back down into the band — cymbals
 * and hats would land on top of the kick and snare the tracker is trying to
 * find, which is exactly the information the envelope depends on.
 *
 * The group delay of a linear-phase FIR is compensated by reading the filter
 * output centred on each output sample, so beat timestamps stay aligned with
 * the original audio. An uncorrected 33-tap filter at 11kHz would put every
 * beat 16 samples (1.5ms) late — small, but it compounds with the click
 * asset's own alignment and there is no reason to accept it.
 */
export function decimate(input: Float32Array, factor: number = ANALYSIS_DECIMATION): Float32Array {
  if (!Number.isInteger(factor) || factor < 1) {
    throw new RangeError(`factor must be a positive integer, got ${factor}`);
  }
  if (factor === 1) return input;

  const kernel = lowpassKernel((CUTOFF_FRACTION * 0.5) / factor, TAPS);
  const mid = (TAPS - 1) >> 1;
  const outLength = Math.floor(input.length / factor);
  const out = new Float32Array(outLength);

  for (let n = 0; n < outLength; n++) {
    const centre = n * factor;
    let acc = 0;
    for (let k = 0; k < TAPS; k++) {
      const idx = centre + k - mid;
      // Zero outside the signal: a 16-sample edge effect on a multi-minute
      // track, and the alternative (reflection) would invent onsets.
      if (idx >= 0 && idx < input.length) acc += input[idx] * kernel[k];
    }
    out[n] = acc;
  }
  return out;
}
