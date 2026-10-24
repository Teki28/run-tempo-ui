import { describe, expect, it } from 'vitest';
import { clickTimes, fallbackClickTimes } from './schedule';

/** Beats at a perfectly steady tempo, for the cases where drift is not the point. */
const steady = (bpm: number, count: number) =>
  Array.from({ length: count }, (_, i) => (i * 60) / bpm);

/** Beats that accelerate linearly from `fromBpm` to `toBpm` over `count` beats. */
function drifting(fromBpm: number, toBpm: number, count: number): number[] {
  const beats = [0];
  for (let i = 0; i < count - 1; i++) {
    const bpm = fromBpm + ((toBpm - fromBpm) * i) / (count - 1);
    beats.push(beats[i] + 60 / bpm);
  }
  return beats;
}

describe('clickTimes', () => {
  it('puts clicks on the detected beats at x1', () => {
    const beats = steady(120, 8);
    expect(clickTimes({ beats, ratio: 1, durationSec: 4 })).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
  });

  it('respects the phase of a song that does not start on beat one', () => {
    // The fixed grid this replaces always started at t=0; a song whose first
    // beat is 300ms in got a click 300ms early, every single beat.
    const beats = [0.3, 0.8, 1.3, 1.8];
    expect(clickTimes({ beats, ratio: 1, durationSec: 2 })).toEqual([0.3, 0.8, 1.3, 1.8]);
  });

  it('adds midpoints at x2', () => {
    const beats = steady(85, 4);
    const times = clickTimes({ beats, ratio: 2, durationSec: 2 });
    const interval = 60 / 85;
    expect(times[0]).toBeCloseTo(0, 10);
    expect(times[1]).toBeCloseTo(interval / 2, 10);
    expect(times[2]).toBeCloseTo(interval, 10);
    expect(times[3]).toBeCloseTo(interval * 1.5, 10);
  });

  it('takes every other beat at x0.5', () => {
    const beats = steady(120, 9);
    expect(clickTimes({ beats, ratio: 0.5, durationSec: 4 })).toEqual([0, 1, 2, 3]);
  });

  it('fits three clicks across every two beats at x1.5', () => {
    const beats = steady(120, 7);
    const times = clickTimes({ beats, ratio: 1.5, durationSec: 2 });
    // Two beats span 1s at 120bpm, so three clicks across them land every 1/3s.
    expect(times).toHaveLength(6);
    times.forEach((t, k) => expect(t).toBeCloseTo(k / 3, 9));
    // Every third click coincides with a real detected beat.
    expect(times[0]).toBeCloseTo(beats[0], 9);
    expect(times[3]).toBeCloseTo(beats[2], 9);
  });

  it('follows tempo drift instead of walking away from it', () => {
    // This is the case a fixed grid cannot do at all.
    const beats = drifting(124, 136, 60);
    const times = clickTimes({ beats, ratio: 1, durationSec: beats[beats.length - 1] });
    for (const beat of beats.slice(0, times.length)) {
      expect(times.some((t) => Math.abs(t - beat) < 1e-9)).toBe(true);
    }
  });

  it('keeps subdivided clicks between the right pair of drifting beats', () => {
    const beats = drifting(124, 136, 40);
    const times = clickTimes({ beats, ratio: 2, durationSec: beats[beats.length - 1] });
    // Every odd click is an interpolated midpoint; it must sit strictly inside
    // the beats either side of it, however much the tempo has moved.
    for (let k = 1; k < times.length - 1; k += 2) {
      const before = beats[(k - 1) / 2];
      const after = beats[(k + 1) / 2];
      expect(times[k]).toBeGreaterThan(before);
      expect(times[k]).toBeLessThan(after);
      expect(times[k]).toBeCloseTo((before + after) / 2, 9);
    }
  });

  it('shifts every click by the nudge offset', () => {
    const beats = steady(120, 6);
    const times = clickTimes({ beats, ratio: 1, nudgeMs: 40, durationSec: 3 });
    expect(times[0]).toBeCloseTo(0.04, 10);
    expect(times[1]).toBeCloseTo(0.54, 10);
  });

  it('drops clicks a negative nudge pushes before the start', () => {
    const beats = steady(120, 6);
    const times = clickTimes({ beats, ratio: 1, nudgeMs: -100, durationSec: 3 });
    expect(times[0]).toBeCloseTo(0.4, 10);
    expect(times.every((t) => t >= 0)).toBe(true);
  });

  it('scales beat times by the stretch applied to the music', () => {
    const beats = steady(120, 8);
    // Slowing the music to 0.92 stretches the gaps between its beats to match.
    const times = clickTimes({ beats, ratio: 1, playbackRate: 0.92, durationSec: 4 });
    expect(times[1]).toBeCloseTo(0.5 / 0.92, 10);
    expect(times[2]).toBeCloseTo(1 / 0.92, 10);
  });

  it('carries on at the closing tempo when detection stops early', () => {
    // Trackers routinely give up before a fade-out ends.
    const beats = steady(120, 4); // covers 1.5s
    const times = clickTimes({ beats, ratio: 1, durationSec: 4 });
    expect(times.length).toBe(8);
    expect(times[7]).toBeCloseTo(3.5, 6);
  });

  it('stays inside the requested duration', () => {
    const beats = steady(174, 100);
    for (const durationSec of [0.5, 1, 7.3, 10]) {
      const times = clickTimes({ beats, ratio: 2, durationSec });
      expect(times.every((t) => t < durationSec)).toBe(true);
    }
  });

  it('returns nothing when there is nothing to work with', () => {
    expect(clickTimes({ beats: [], ratio: 1, durationSec: 10 })).toEqual([]);
    expect(clickTimes({ beats: steady(120, 4), ratio: 1, durationSec: 0 })).toEqual([]);
    expect(clickTimes({ beats: steady(120, 4), ratio: 1, durationSec: -1 })).toEqual([]);
  });

  it('copes with a single detected beat', () => {
    const times = clickTimes({ beats: [0.25], ratio: 1, durationSec: 2 });
    expect(times[0]).toBeCloseTo(0.25, 10);
    expect(times.length).toBeGreaterThan(1);
  });

  it.each([0, -1, Number.NaN])('rejects ratio=%s', (ratio) => {
    expect(() => clickTimes({ beats: steady(120, 4), ratio, durationSec: 4 })).toThrow(RangeError);
  });

  it.each([0, -1, Number.NaN])('rejects playbackRate=%s', (playbackRate) => {
    expect(() =>
      clickTimes({ beats: steady(120, 4), ratio: 1, playbackRate, durationSec: 4 }),
    ).toThrow(RangeError);
  });
});

describe('fallbackClickTimes', () => {
  it('reproduces the old fixed grid', () => {
    expect(fallbackClickTimes(120, 2)).toEqual([0, 0.5, 1, 1.5]);
  });

  it('applies the nudge and stays in range', () => {
    const times = fallbackClickTimes(120, 2, 100);
    expect(times[0]).toBeCloseTo(0.1, 10);
    expect(times.every((t) => t >= 0 && t < 2)).toBe(true);
  });
});
