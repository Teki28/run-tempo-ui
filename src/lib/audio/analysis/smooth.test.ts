import { describe, expect, it } from 'vitest';
import { smoothBeats } from './smooth';

const steady = (bpm: number, count: number) =>
  Array.from({ length: count }, (_, i) => (i * 60) / bpm);

describe('smoothBeats', () => {
  it('leaves an already-perfect sequence alone', () => {
    const beats = steady(120, 30);
    for (const [i, value] of smoothBeats(beats).entries()) {
      expect(value).toBeCloseTo(beats[i], 9);
    }
  });

  it('removes independent per-beat noise', () => {
    const truth = steady(120, 60);
    let seed = 12345;
    const noisy = truth.map((t) => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      // +/-6ms of independent error, as the envelope grid produces.
      return t + (((seed >>> 0) / 4294967296) - 0.5) * 0.012;
    });

    const error = (list: number[]) =>
      Math.sqrt(list.reduce((a, t, i) => a + (t - truth[i]) ** 2, 0) / list.length);

    expect(error(smoothBeats(noisy))).toBeLessThan(error(noisy) * 0.6);
  });

  it('follows a genuine tempo change rather than flattening it', () => {
    // Accelerating from 120 to 140: the smoothed intervals must still shorten.
    const beats = [0];
    for (let i = 0; i < 60; i++) {
      beats.push(beats[i] + 60 / (120 + (20 * i) / 60));
    }
    const smoothed = smoothBeats(beats);
    const gap = (list: number[], i: number) => list[i + 1] - list[i];

    expect(gap(smoothed, 5)).toBeGreaterThan(gap(smoothed, 50));
    // And it tracks the original closely, not just directionally.
    for (let i = 0; i < beats.length; i++) {
      expect(smoothed[i]).toBeCloseTo(beats[i], 2);
    }
  });

  it('does not lag the tempo the way a moving average would', () => {
    const beats = [0];
    for (let i = 0; i < 40; i++) beats.push(beats[i] + 60 / (120 + (30 * i) / 40));
    const smoothed = smoothBeats(beats);
    // A moving average of positions pulls each beat towards the window mean,
    // which on an accelerating track shows up as a systematic bias.
    const bias =
      smoothed.reduce((a, t, i) => a + (t - beats[i]), 0) / smoothed.length;
    expect(Math.abs(bias)).toBeLessThan(0.002);
  });

  it('passes short sequences through untouched', () => {
    for (const count of [0, 1, 2, 5, 8]) {
      const beats = steady(120, count);
      expect(smoothBeats(beats)).toEqual(beats);
    }
  });

  it('keeps the sequence ascending', () => {
    let seed = 99;
    const beats = steady(170, 80).map((t) => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return t + (((seed >>> 0) / 4294967296) - 0.5) * 0.02;
    });
    const smoothed = smoothBeats(beats);
    for (let i = 1; i < smoothed.length; i++) {
      expect(smoothed[i]).toBeGreaterThan(smoothed[i - 1]);
    }
  });
});
