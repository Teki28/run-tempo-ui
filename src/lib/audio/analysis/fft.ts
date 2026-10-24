/**
 * Iterative radix-2 Cooley-Tukey FFT, in place.
 *
 * Hand-rolled rather than pulled from a package: the detector needs exactly
 * one transform size, called tens of thousands of times per track, and the
 * twiddle factors are worth precomputing once per size. `FftPlan` holds that
 * table so a whole track's STFT allocates nothing per frame.
 */
export class FftPlan {
  readonly size: number;
  private readonly cos: Float32Array;
  private readonly sin: Float32Array;
  private readonly reversed: Uint32Array;

  constructor(size: number) {
    if (size < 2 || (size & (size - 1)) !== 0) {
      throw new RangeError(`FFT size must be a power of two >= 2, got ${size}`);
    }
    this.size = size;
    const half = size >> 1;
    this.cos = new Float32Array(half);
    this.sin = new Float32Array(half);
    for (let i = 0; i < half; i++) {
      this.cos[i] = Math.cos((-2 * Math.PI * i) / size);
      this.sin[i] = Math.sin((-2 * Math.PI * i) / size);
    }

    // Bit-reversal permutation, precomputed for the same reason.
    const bits = Math.log2(size);
    this.reversed = new Uint32Array(size);
    for (let i = 0; i < size; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >>> b) & 1) << (bits - 1 - b);
      this.reversed[i] = r;
    }
  }

  /** Transform `re`/`im` in place. Both must be `size` long. */
  transform(re: Float32Array, im: Float32Array): void {
    const n = this.size;
    const rev = this.reversed;

    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i];
        re[i] = re[j];
        re[j] = t;
        t = im[i];
        im[i] = im[j];
        im[j] = t;
      }
    }

    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1;
      const step = n / len;
      for (let i = 0; i < n; i += len) {
        for (let k = 0; k < half; k++) {
          const tw = k * step;
          const wr = this.cos[tw];
          const wi = this.sin[tw];
          const a = i + k;
          const b = a + half;
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
      }
    }
  }
}

/** A periodic Hann window, the right choice for overlapping STFT analysis. */
export function hannWindow(size: number): Float32Array {
  const w = new Float32Array(size);
  for (let i = 0; i < size; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / size));
  return w;
}
