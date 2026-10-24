import { describe, expect, it } from 'vitest';
import { chooseRatio, needsSnapOffer, reachableRange, snapToSong } from './ratio';

describe('chooseRatio', () => {
  describe('the four cases from the spec, at the default 8% limit', () => {
    it('85 -> 170 clicks every half-beat and leaves the music alone', () => {
      const choice = chooseRatio(85, 170);
      expect(choice.ratio).toBe(2);
      expect(choice.outcome).toBe('exact');
      expect(choice.playbackRate).toBe(1);
      expect(choice.stretchPct).toBe(0);
      expect(choice.effectiveBpm).toBeCloseTo(170, 10);
      expect(choice.residualBpm).toBeCloseTo(0, 10);
    });

    it('175 -> 170 nudges the music down a few percent on the beat itself', () => {
      const choice = chooseRatio(175, 170);
      expect(choice.ratio).toBe(1);
      expect(choice.outcome).toBe('stretched');
      expect(choice.stretchPct).toBeCloseTo(-2.857, 3);
      expect(choice.effectiveBpm).toBeCloseTo(170, 10);
      expect(needsSnapOffer(choice)).toBe(false);
    });

    it('128 -> 170 picks x1.5 and runs out of stretch', () => {
      const choice = chooseRatio(128, 170);
      expect(choice.ratio).toBe(1.5);
      expect(choice.naturalBpm).toBe(192);
      expect(choice.outcome).toBe('clamped');
      // Wants -11.5%, allowed -8%.
      expect(choice.stretchPct).toBeCloseTo(-8, 10);
      expect(choice.effectiveBpm).toBeCloseTo(176.64, 2);
      expect(choice.residualBpm).toBeCloseTo(-6.64, 2);
      expect(needsSnapOffer(choice)).toBe(true);
    });

    it('60 -> 170 is too far to reach and offers the snap instead', () => {
      const choice = chooseRatio(60, 170);
      expect(choice.ratio).toBe(2);
      expect(choice.naturalBpm).toBe(120);
      expect(choice.outcome).toBe('clamped');
      expect(choice.stretchPct).toBeCloseTo(8, 10);
      expect(choice.effectiveBpm).toBeCloseTo(129.6, 2);
      expect(needsSnapOffer(choice)).toBe(true);

      const snapped = snapToSong(choice);
      expect(snapped.playbackRate).toBe(1);
      expect(snapped.effectiveBpm).toBe(120);
      expect(snapped.residualBpm).toBe(50);
    });
  });

  it('compares what each ratio can deliver, not where it starts', () => {
    // x1 starts closer to 170 in absolute terms than x2 does (42 vs 86 away),
    // but after clamping x1.5 delivers 176.6 against x1's 138.2. Choosing by
    // natural distance alone would pick x1 here and sound 30 BPM slow.
    const choice = chooseRatio(128, 170, { maxStretchPct: 8 });
    expect(choice.ratio).toBe(1.5);
    expect(Math.abs(choice.residualBpm)).toBeLessThan(7);
  });

  it('reaches 170 from 128 once the limit is raised enough', () => {
    const choice = chooseRatio(128, 170, { maxStretchPct: 12 });
    expect(choice.ratio).toBe(1.5);
    expect(choice.outcome).toBe('stretched');
    expect(choice.effectiveBpm).toBeCloseTo(170, 10);
    expect(choice.stretchPct).toBeCloseTo(-11.458, 3);
  });

  it('never stretches past the limit in either direction', () => {
    for (const songBpm of [40, 60, 85, 100, 128, 140, 175, 200, 240]) {
      for (const maxStretchPct of [0, 5, 8, 10]) {
        const choice = chooseRatio(songBpm, 170, { maxStretchPct });
        expect(Math.abs(choice.stretchPct)).toBeLessThanOrEqual(maxStretchPct + 1e-9);
      }
    }
  });

  it('does nothing at all when the song already matches the target', () => {
    const choice = chooseRatio(170, 170);
    expect(choice.ratio).toBe(1);
    expect(choice.outcome).toBe('exact');
    expect(choice.playbackRate).toBe(1);
  });

  it('prefers the ratio nearest 1 when two deliver the same cadence', () => {
    // A zero stretch budget makes x1 on a 170 song and x2 on an 85 song both
    // land exactly on 170; the tie must not be broken arbitrarily.
    expect(chooseRatio(170, 170, { maxStretchPct: 0 }).ratio).toBe(1);
  });

  it('honours a zero stretch budget by snapping to the nearest natural rate', () => {
    const choice = chooseRatio(128, 170, { maxStretchPct: 0 });
    expect(choice.playbackRate).toBe(1);
    expect(choice.effectiveBpm).toBe(192);
    expect(choice.outcome).toBe('clamped');
  });

  it('accepts a widened ratio set', () => {
    // x3 on a 60 BPM song is 180, a far better answer for a 170 cadence than
    // the x2 that the default set is limited to.
    const choice = chooseRatio(60, 170, { ratios: [0.5, 1, 1.5, 2, 3, 4] });
    expect(choice.ratio).toBe(3);
    expect(choice.outcome).toBe('stretched');
    expect(choice.effectiveBpm).toBeCloseTo(170, 10);
  });

  it.each([
    [0, 170],
    [-1, 170],
    [Number.NaN, 170],
    [Number.POSITIVE_INFINITY, 170],
    [120, 0],
    [120, Number.NaN],
  ])('rejects songBpm=%s targetBpm=%s', (songBpm, targetBpm) => {
    expect(() => chooseRatio(songBpm, targetBpm)).toThrow(RangeError);
  });

  it('rejects an empty ratio set and a negative limit', () => {
    expect(() => chooseRatio(120, 170, { ratios: [] })).toThrow(RangeError);
    expect(() => chooseRatio(120, 170, { maxStretchPct: -1 })).toThrow(RangeError);
  });
});

describe('x4, which the default ratio set now includes', () => {
  it('lets an 80 BPM song reach a 300 target it could not reach on x2', () => {
    const choice = chooseRatio(80, 300);
    expect(choice.ratio).toBe(4);
    expect(choice.naturalBpm).toBe(320);
    expect(choice.outcome).toBe('stretched');
    expect(choice.effectiveBpm).toBeCloseTo(300, 10);
    expect(needsSnapOffer(choice)).toBe(false);
  });

  it('is not preferred when a gentler ratio reaches the target', () => {
    // 85 -> 170 is exact on x2; x4 would be 340 and nowhere near.
    expect(chooseRatio(85, 170).ratio).toBe(2);
    // The ordinary running cases must not move.
    expect(chooseRatio(174, 170).ratio).toBe(1);
    expect(chooseRatio(120, 170).ratio).toBe(1.5);
  });

  it('leaves a band between x2 and x4 that no stretch can cover', () => {
    // 80 x 2 x 1.08 = 172.8 and 80 x 4 x 0.92 = 294.4, so 200 falls in the
    // gap and comes out clamped whichever side it lands on.
    const choice = chooseRatio(80, 200);
    expect(choice.outcome).toBe('clamped');
    expect(needsSnapOffer(choice)).toBe(true);
  });
});

describe('reachableRange', () => {
  it('spans the smallest and largest ratio at the full stretch limit', () => {
    const { minBpm, maxBpm } = reachableRange(80);
    expect(minBpm).toBeCloseTo(80 * 0.5 * 0.92, 10); // 36.8
    expect(maxBpm).toBeCloseTo(80 * 4 * 1.08, 10); // 345.6
  });

  it('agrees with what chooseRatio can actually deliver at the edges', () => {
    const song = 128;
    const { minBpm, maxBpm } = reachableRange(song);
    expect(chooseRatio(song, maxBpm).effectiveBpm).toBeCloseTo(maxBpm, 6);
    expect(chooseRatio(song, minBpm).effectiveBpm).toBeCloseTo(minBpm, 6);
    // A hair beyond either edge can no longer be met.
    expect(chooseRatio(song, maxBpm * 1.01).outcome).toBe('clamped');
    expect(chooseRatio(song, minBpm * 0.99).outcome).toBe('clamped');
  });

  it('honours a custom ratio set and limit', () => {
    const { minBpm, maxBpm } = reachableRange(100, { ratios: [1, 2], maxStretchPct: 0 });
    expect(minBpm).toBeCloseTo(100, 10);
    expect(maxBpm).toBeCloseTo(200, 10);
  });

  it('rejects nonsense input the same way chooseRatio does', () => {
    expect(() => reachableRange(0)).toThrow(RangeError);
    expect(() => reachableRange(Number.NaN)).toThrow(RangeError);
    expect(() => reachableRange(120, { ratios: [] })).toThrow(RangeError);
    expect(() => reachableRange(120, { maxStretchPct: -1 })).toThrow(RangeError);
  });
});
