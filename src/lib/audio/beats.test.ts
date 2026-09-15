import { describe, expect, it } from 'vitest';
import { beatTimes } from './beats';

describe('beatTimes', () => {
  it('places the first beat at the start of the track', () => {
    expect(beatTimes(120, 10)[0]).toBe(0);
  });

  it('spaces beats by 60/bpm', () => {
    const times = beatTimes(120, 10);
    expect(times).toHaveLength(20);
    expect(times[1] - times[0]).toBeCloseTo(0.5, 12);
  });

  it.each([
    [30, 10, 5],
    [120, 10, 20],
    [300, 10, 50],
  ])('emits the right count at %i bpm over %is', (bpm, duration, expected) => {
    expect(beatTimes(bpm, duration)).toHaveLength(expected);
  });

  it('handles tempos the old API had no pre-rendered loop for', () => {
    // 137 is not one of the API's eight PRE_GENERATED_BPMS, which is exactly
    // the case that used to resample (and detune) the click.
    const times = beatTimes(137, 60);
    const interval = 60 / 137;
    expect(times[1] - times[0]).toBeCloseTo(interval, 12);
    expect(times.at(-1)).toBeLessThan(60);
  });

  it('does not drift over a long track', () => {
    // Accumulating `t += interval` would leave the last beat measurably late
    // after several thousand additions; multiplying keeps it exact.
    const bpm = 137;
    const times = beatTimes(bpm, 600);
    const last = times.length - 1;
    expect(times[last]).toBeCloseTo((last * 60) / bpm, 9);
  });

  it('never emits a beat at or past the end', () => {
    for (const bpm of [30, 137, 300]) {
      expect(beatTimes(bpm, 10).at(-1)).toBeLessThan(10);
    }
  });

  it('returns nothing for an empty track', () => {
    expect(beatTimes(120, 0)).toEqual([]);
  });

  it.each([0, -1, NaN, Infinity])('rejects %s bpm', (bpm) => {
    expect(() => beatTimes(bpm, 10)).toThrow(RangeError);
  });
});
