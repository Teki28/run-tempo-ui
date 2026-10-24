import { describe, expect, it } from 'vitest';
import { FftPlan, hannWindow } from './fft';

/** Naive DFT, slow but obviously correct, as the reference. */
function dft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  const outRe = new Float64Array(n);
  const outIm = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    for (let t = 0; t < n; t++) {
      const angle = (-2 * Math.PI * k * t) / n;
      outRe[k] += re[t] * Math.cos(angle) - im[t] * Math.sin(angle);
      outIm[k] += re[t] * Math.sin(angle) + im[t] * Math.cos(angle);
    }
  }
  return { outRe, outIm };
}

describe('FftPlan', () => {
  it.each([2, 4, 8, 16, 64, 256])('matches a naive DFT at size %i', (size) => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5;
    const re = Float32Array.from({ length: size }, rnd);
    const im = new Float32Array(size);
    const reference = dft(re, im);

    const fre = Float32Array.from(re);
    const fim = Float32Array.from(im);
    new FftPlan(size).transform(fre, fim);

    for (let k = 0; k < size; k++) {
      expect(fre[k]).toBeCloseTo(reference.outRe[k], 3);
      expect(fim[k]).toBeCloseTo(reference.outIm[k], 3);
    }
  });

  it('puts a pure sine in exactly one bin', () => {
    const size = 256;
    const bin = 17;
    const re = new Float32Array(size);
    for (let i = 0; i < size; i++) re[i] = Math.sin((2 * Math.PI * bin * i) / size);
    const im = new Float32Array(size);
    new FftPlan(size).transform(re, im);

    const mag = (k: number) => Math.hypot(re[k], im[k]);
    expect(mag(bin)).toBeGreaterThan(size / 4);
    for (let k = 0; k < size / 2; k++) {
      if (k !== bin) expect(mag(k)).toBeLessThan(1);
    }
  });

  it('is reusable across frames without carrying state', () => {
    const plan = new FftPlan(16);
    const run = () => {
      const re = Float32Array.from({ length: 16 }, (_, i) => (i === 0 ? 1 : 0));
      const im = new Float32Array(16);
      plan.transform(re, im);
      return Array.from(re);
    };
    expect(run()).toEqual(run());
  });

  it.each([0, 1, 3, 7, 100, -4])('rejects non-power-of-two size %i', (size) => {
    expect(() => new FftPlan(size)).toThrow(RangeError);
  });
});

describe('hannWindow', () => {
  it('starts at zero and peaks in the middle', () => {
    const w = hannWindow(8);
    expect(w[0]).toBeCloseTo(0, 10);
    expect(w[4]).toBeCloseTo(1, 10);
  });

  it('sums to size/2, as a periodic Hann must', () => {
    const w = hannWindow(64);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(32, 6);
  });
});
