import { describe, expect, it } from 'vitest';
import { decimate } from './decimate';

const SR = 44100;

/** Peak amplitude of a sine at `hz` after decimation, measured by projection. */
function surviving(hz: number, factor = 4): number {
  const n = SR; // one second
  const input = Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * hz * i) / SR));
  const out = decimate(input, factor);
  const outRate = SR / factor;
  // Project onto the same frequency at the new rate, skipping filter edges.
  const skip = 64;
  let re = 0;
  let im = 0;
  for (let i = skip; i < out.length - skip; i++) {
    const angle = (2 * Math.PI * hz * i) / outRate;
    re += out[i] * Math.cos(angle);
    im += out[i] * Math.sin(angle);
  }
  const count = out.length - 2 * skip;
  return (2 * Math.hypot(re, im)) / count;
}

describe('decimate', () => {
  it('shortens the signal by the factor', () => {
    expect(decimate(new Float32Array(44100), 4)).toHaveLength(11025);
    expect(decimate(new Float32Array(1000), 2)).toHaveLength(500);
  });

  it('is a no-op at factor 1 and returns the same array', () => {
    const input = new Float32Array([1, 2, 3]);
    expect(decimate(input, 1)).toBe(input);
  });

  it('passes the band onsets actually live in', () => {
    for (const hz of [100, 500, 1000, 2000, 3000]) {
      expect(surviving(hz)).toBeGreaterThan(0.85);
    }
  });

  it('rejects content that would alias back into the band', () => {
    // Above the decimated Nyquist of 5512Hz there must be nothing left to fold.
    for (const hz of [8000, 10000, 15000]) {
      expect(surviving(hz)).toBeLessThan(0.02);
    }
  });

  it('keeps DC gain at unity so onset magnitudes stay comparable', () => {
    const input = new Float32Array(4096).fill(1);
    const out = decimate(input, 4);
    // Skip the filter's edge ramp.
    for (let i = 16; i < out.length - 16; i++) expect(out[i]).toBeCloseTo(1, 4);
  });

  it('preserves timing: an impulse stays where it was', () => {
    // Group-delay compensation is what this checks. An uncorrected 33-tap
    // filter would put the impulse 16 input samples late.
    const input = new Float32Array(4096);
    const at = 2000;
    input[at] = 1;
    const out = decimate(input, 4);

    let peak = 0;
    let peakAt = 0;
    for (let i = 0; i < out.length; i++) {
      if (Math.abs(out[i]) > peak) {
        peak = Math.abs(out[i]);
        peakAt = i;
      }
    }
    expect(peakAt * 4).toBeGreaterThan(at - 8);
    expect(peakAt * 4).toBeLessThan(at + 8);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects factor=%s', (factor) => {
    expect(() => decimate(new Float32Array(100), factor)).toThrow(RangeError);
  });
});
