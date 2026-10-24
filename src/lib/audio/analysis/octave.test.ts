import { describe, expect, it } from 'vitest';
import { bpmFromBeats, foldToCanonical, intervalSpread, medianInterval } from './octave';

describe('foldToCanonical', () => {
  it.each([
    [60, 120, 2],
    [40, 80, 2],
    [30, 120, 4],
    [240, 120, 0.5],
    [300, 150, 0.5],
    [400, 100, 0.25],
  ])('folds an out-of-band %i to %i (x%s)', (input, expected, factor) => {
    const fold = foldToCanonical(input);
    expect(fold.bpm).toBeCloseTo(expected, 6);
    expect(fold.factor).toBeCloseTo(factor, 6);
  });

  it.each([87, 85, 128, 170, 174, 180])('leaves an in-band %i alone', (bpm) => {
    expect(foldToCanonical(bpm)).toEqual({ bpm, factor: 1 });
  });

  it('cannot resolve an in-band octave error, and must not pretend to', () => {
    // 87 and 174 are both musically plausible and both inside the band, so
    // folding has no basis for choosing. Telling the two apart needs the onset
    // envelope (is there energy on the midpoints?), which is the detector's
    // job; ratio choice then absorbs whichever way it went, because x2 of 87
    // and x1 of 174 place clicks identically.
    expect(foldToCanonical(87).bpm).toBe(87);
    expect(foldToCanonical(174).bpm).toBe(174);
  });

  it('terminates on a band narrower than an octave', () => {
    // 100-110 cannot contain every tempo; the walk must stop, not oscillate.
    const fold = foldToCanonical(174, 100, 110);
    expect(Number.isFinite(fold.bpm)).toBe(true);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects bpm=%s', (bpm) => {
    expect(() => foldToCanonical(bpm)).toThrow(RangeError);
  });
});

describe('medianInterval and bpmFromBeats', () => {
  it('reads the tempo off a steady beat list', () => {
    const beats = Array.from({ length: 20 }, (_, i) => (i * 60) / 128);
    expect(bpmFromBeats(beats)).toBeCloseTo(128, 9);
  });

  it('ignores a single dropped beat', () => {
    // One gap at double length is exactly what a mean would smear.
    const beats = [0, 0.5, 1.5, 2, 2.5, 3, 3.5];
    expect(medianInterval(beats)).toBeCloseTo(0.5, 9);
    expect(bpmFromBeats(beats)).toBeCloseTo(120, 9);
  });

  it('has no answer for fewer than two beats', () => {
    expect(bpmFromBeats([])).toBeNaN();
    expect(bpmFromBeats([1])).toBeNaN();
  });
});

describe('intervalSpread', () => {
  it('is zero for a metronomic list', () => {
    const beats = Array.from({ length: 20 }, (_, i) => i * 0.5);
    expect(intervalSpread(beats)).toBeCloseTo(0, 9);
  });

  it('grows with drift', () => {
    const steady = Array.from({ length: 20 }, (_, i) => i * 0.5);
    const drifted = [0];
    for (let i = 0; i < 19; i++) drifted.push(drifted[i] + 0.4 + i * 0.01);
    expect(intervalSpread(drifted)).toBeGreaterThan(intervalSpread(steady));
  });
});
