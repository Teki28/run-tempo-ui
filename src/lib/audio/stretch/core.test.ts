import { describe, expect, it } from 'vitest';
import { stretchChannels } from './core';

const SR = 44100;

const sine = (hz: number, seconds: number, rate = SR) =>
  Float32Array.from({ length: Math.round(seconds * rate) }, (_, i) =>
    Math.sin((2 * Math.PI * hz * i) / rate),
  );

/** Dominant frequency, by projecting onto a set of candidate frequencies. */
function dominantHz(signal: Float32Array, candidates: number[], rate = SR): number {
  let best = 0;
  let bestPower = -1;
  // Skip the stretcher's warm-up and tail.
  const from = Math.round(rate * 0.25);
  const to = signal.length - from;
  for (const hz of candidates) {
    let re = 0;
    let im = 0;
    for (let i = from; i < to; i++) {
      const angle = (2 * Math.PI * hz * i) / rate;
      re += signal[i] * Math.cos(angle);
      im += signal[i] * Math.sin(angle);
    }
    const power = re * re + im * im;
    if (power > bestPower) {
      bestPower = power;
      best = hz;
    }
  }
  return best;
}

describe('stretchChannels', () => {
  it.each([[1.08], [0.92], [1.0], [1.1], [0.9]])('changes duration by %s', (factor) => {
    const input = sine(440, 2);
    const [out] = stretchChannels({ channels: [input], factor });
    // Exact, because the flush padding guarantees the target is reached and
    // the output is then trimmed to it. Without the padding SoundTouch comes
    // up 9-12k frames short and the end of the track is lost.
    expect(out.length).toBe(Math.round(input.length * factor));
  });

  it('preserves pitch while changing duration', () => {
    // The entire point of time-stretching rather than resampling: resampling
    // 440Hz by 1.08 would land on 407Hz.
    const [out] = stretchChannels({ channels: [sine(440, 2)], factor: 1.08 });
    expect(dominantHz(out, [392, 407, 415, 440, 466, 494])).toBe(440);
  });

  it('leaves audio essentially untouched at factor 1', () => {
    const input = sine(440, 1);
    const [out] = stretchChannels({ channels: [input], factor: 1 });
    expect(out.length).toBe(input.length);
    expect(dominantHz(out, [415, 440, 466])).toBe(440);
  });

  it('keeps both channels of a stereo source', () => {
    const left = sine(440, 1);
    const right = sine(880, 1);
    const out = stretchChannels({ channels: [left, right], factor: 1.05 });
    expect(out).toHaveLength(2);
    expect(dominantHz(out[0], [440, 880])).toBe(440);
    expect(dominantHz(out[1], [440, 880])).toBe(880);
  });

  it('returns mono for a mono source', () => {
    expect(stretchChannels({ channels: [sine(440, 1)], factor: 1.05 })).toHaveLength(1);
  });

  it('reports monotonically increasing progress ending at 1', () => {
    const seen: number[] = [];
    stretchChannels({
      channels: [sine(440, 3)],
      factor: 1.08,
      onProgress: (f) => seen.push(f),
    });
    expect(seen.length).toBeGreaterThan(1);
    expect(seen.at(-1)).toBeCloseTo(1, 2);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
  });

  it('does not emit silence at the end', () => {
    // A tail of zeros reads as a glitch on a finished download.
    const [out] = stretchChannels({ channels: [sine(440, 2)], factor: 1.08 });
    const tail = out.subarray(out.length - 2000);
    const energy = tail.reduce((a, s) => a + s * s, 0) / tail.length;
    expect(energy).toBeGreaterThan(0.01);
  });

  it('handles an empty source', () => {
    expect(stretchChannels({ channels: [new Float32Array(0)], factor: 1.08 })[0]).toHaveLength(0);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects factor=%s', (factor) => {
    expect(() => stretchChannels({ channels: [sine(440, 1)], factor })).toThrow(RangeError);
  });

  it('rejects an empty channel list', () => {
    expect(() => stretchChannels({ channels: [], factor: 1 })).toThrow(RangeError);
  });
});
