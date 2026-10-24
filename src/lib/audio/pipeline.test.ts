import { describe, expect, it } from 'vitest';
import { detectBeats } from './analysis/detect';
import { planClicks, planMix } from './plan';
import type { MixSettings } from './plan';

const SR = 44100;
const TARGET = 170;

/**
 * Ground truth for a synthetic track: the audio, and where its beats really
 * are. Testing against the generator's own beat list — rather than against the
 * detector's output — is what makes this an end-to-end check rather than a
 * tautology.
 */
function synthTrack(options: { bpm: number; seconds: number; drift?: number; leadIn?: number }) {
  const { bpm, seconds, drift = 0, leadIn = 0 } = options;
  const signal = new Float32Array(Math.round(seconds * SR));
  const trueBeats: number[] = [];
  let seed = 2463534242;
  const rnd = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296 - 0.5;
  };

  const hit = (at: number, level: number, decay: number, tone: number) => {
    const start = Math.round(at * SR);
    for (let i = 0; i < SR * decay * 5; i++) {
      const idx = start + i;
      if (idx < 0 || idx >= signal.length) break;
      signal[idx] +=
        level * Math.exp(-i / (SR * decay)) * (rnd() * 0.6 + Math.sin((2 * Math.PI * tone * i) / SR) * 0.7);
    }
  };

  let t = leadIn;
  let beat = 0;
  while (t < seconds) {
    trueBeats.push(t);
    const bar = beat % 4;
    if (bar === 0) hit(t, 1.0, 0.05, 55);
    else if (bar === 2) hit(t, 0.8, 0.04, 200);
    else hit(t, 0.55, 0.03, 150);
    t += 60 / (bpm * (1 + drift * (t / seconds)));
    beat++;
  }
  return { signal, trueBeats };
}

/**
 * Of the clicks that are supposed to coincide with a beat, how far off are
 * they? Returns the worst case in seconds.
 *
 * At ratio r, every r-th click should sit on a beat (r=2 puts every second
 * click on one, r=0.5 puts every click on one). The beats are compared on the
 * stretched timeline, since that is where the clicks live.
 */
function worstAlignment(
  clicks: number[],
  trueBeats: number[],
  ratio: number,
  playbackRate: number,
): number {
  const stretched = trueBeats.map((t) => t / playbackRate);
  const step = Math.max(1, Math.round(ratio));
  let worst = 0;
  // Skip the first and last few: the tracker has no history at the very start
  // and extrapolates past its last detection at the end.
  for (let k = step * 2; k < clicks.length - step * 2; k += step) {
    let nearest = Infinity;
    for (const beat of stretched) nearest = Math.min(nearest, Math.abs(clicks[k] - beat));
    worst = Math.max(worst, nearest);
  }
  return worst;
}

/** Gaps between consecutive clicks, in milliseconds. */
const clickGapsMs = (clicks: number[]): number[] =>
  clicks.slice(1).map((t, i) => (t - clicks[i]) * 1000);

/**
 * Error in the delivered click period, in milliseconds.
 *
 * Milliseconds rather than BPM throughout: at a 170 cadence a single BPM is
 * only 3.5ms, so a tolerance stated in BPM reads as far looser than it is and
 * a tight one is really a sub-millisecond demand. Milliseconds are also the
 * unit a listener hears in.
 */
function periodErrorMs(clicks: number[], effectiveBpm: number): number {
  const gaps = [...clickGapsMs(clicks)].sort((a, b) => a - b);
  return gaps[gaps.length >> 1] - 60000 / effectiveBpm;
}

/** Spread of click gaps about their median, in milliseconds. */
function jitterMs(clicks: number[], percentile = 0.95): number {
  const gaps = clickGapsMs(clicks);
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1];
  const deviation = gaps.map((g) => Math.abs(g - median)).sort((a, b) => a - b);
  return deviation[Math.floor(deviation.length * percentile)];
}

const settings = (overrides: Partial<MixSettings> = {}): MixSettings => ({
  bpm: TARGET,
  volume: 100,
  ...overrides,
});

describe('end to end: detection through to click placement', () => {
  it('a steady EDM track at 128 reaches the cadence at x1.5 and lands on the beats', () => {
    const { signal, trueBeats } = synthTrack({ bpm: 128, seconds: 40 });
    const analysis = detectBeats(signal, { sampleRate: SR });
    const config = settings();
    const plan = planMix(analysis, config);

    expect(plan.beatLocked).toBe(true);
    expect(plan.songBpm).toBeCloseTo(128, 0);
    expect(plan.choice!.ratio).toBe(1.5);
    // 192 natural, capped at -8%: the click cannot quite reach 170.
    expect(plan.choice!.outcome).toBe('clamped');
    expect(plan.effectiveBpm).toBeCloseTo(176.6, 0);

    const duration = (40 * 1) / plan.playbackRate;
    const clicks = planClicks(plan, analysis, config, duration);

    // The delivered period is within a millisecond of what the plan promised.
    expect(Math.abs(periodErrorMs(clicks, plan.effectiveBpm))).toBeLessThan(2);
    // And the click sits still: on a metronomic song all remaining spread is
    // estimation noise, which the beat smoothing takes to ~1ms.
    expect(jitterMs(clicks)).toBeLessThan(3);

    // At x1.5 every third click must coincide with a real beat.
    const stretchedBeats = trueBeats.map((t) => t / plan.playbackRate);
    for (let k = 6; k < clicks.length - 6; k += 3) {
      const nearest = Math.min(...stretchedBeats.map((b) => Math.abs(clicks[k] - b)));
      expect(nearest).toBeLessThan(0.035);
    }
  });

  it('a slow 85 track hits 170 exactly, on the beat and with no stretching', () => {
    // The spec's own example, and the case that must not be stretched at all.
    const { signal, trueBeats } = synthTrack({ bpm: 85, seconds: 40 });
    const analysis = detectBeats(signal, { sampleRate: SR });
    const config = settings();
    const plan = planMix(analysis, config);

    expect(plan.choice!.ratio).toBe(2);
    expect(plan.playbackRate).toBeCloseTo(1, 2);
    expect(plan.effectiveBpm).toBeCloseTo(170, 0);

    const clicks = planClicks(plan, analysis, config, 40);
    expect(Math.abs(periodErrorMs(clicks, 170))).toBeLessThan(2);
    expect(jitterMs(clicks)).toBeLessThan(3);
    // Every second click is a real beat; the ones between are its midpoint.
    expect(worstAlignment(clicks, trueBeats, 2, plan.playbackRate)).toBeLessThan(0.035);
  });

  it('a drifting track keeps the clicks on the beats as the tempo moves', () => {
    // The case that a fixed grid cannot do at all: by the end of 60s the
    // music has moved ~12 BPM, so a grid set at the opening tempo would be
    // most of a beat out.
    const { signal, trueBeats } = synthTrack({ bpm: 124, seconds: 60, drift: 0.097 });
    const analysis = detectBeats(signal, { sampleRate: SR });
    const config = settings();
    const plan = planMix(analysis, config);

    expect(plan.beatLocked).toBe(true);
    const duration = 60 / plan.playbackRate;
    const clicks = planClicks(plan, analysis, config, duration);
    const stretchedBeats = trueBeats.map((t) => t / plan.playbackRate);

    // The click period must shorten as the song speeds up — this is the
    // behaviour a fixed grid cannot have, and the reason the jitter metric is
    // meaningless on this track: the spread *is* the drift being followed.
    const gaps = clickGapsMs(clicks);
    const earlyGap = gaps.slice(2, 10).reduce((a, b) => a + b, 0) / 8;
    const lateGap = gaps.slice(-10, -2).reduce((a, b) => a + b, 0) / 8;
    expect(lateGap).toBeLessThan(earlyGap - 15);

    // Alignment must hold at the END of the track, not just the start, where
    // a grid set at the opening tempo would be most of a beat out.
    const step = 3;
    const from = Math.floor(clicks.length * 0.85);
    for (let k = from - (from % step); k < clicks.length - step; k += step) {
      const nearest = Math.min(...stretchedBeats.map((b) => Math.abs(clicks[k] - b)));
      expect(nearest).toBeLessThan(0.04);
    }
  });

  it('beats a fixed grid on the drifting track, which is the whole point', () => {
    const { signal, trueBeats } = synthTrack({ bpm: 124, seconds: 60, drift: 0.097 });
    const analysis = detectBeats(signal, { sampleRate: SR });
    const config = settings({ bpm: 124 });
    const plan = planMix(analysis, config);

    const beatLocked = planClicks(plan, analysis, config, 60 / plan.playbackRate);
    const grid = planClicks(
      { ...plan, beatLocked: false, choice: null, playbackRate: 1 },
      analysis,
      config,
      60,
    );

    const error = (clicks: number[], rate: number) => {
      const stretchedBeats = trueBeats.map((t) => t / rate);
      // Compare only over the final third, where drift has accumulated.
      const late = clicks.slice(Math.floor(clicks.length * 0.67));
      let total = 0;
      for (const click of late) {
        total += Math.min(...stretchedBeats.map((b) => Math.abs(click - b)));
      }
      return total / late.length;
    };

    const lockedError = error(beatLocked, plan.playbackRate);
    const gridError = error(grid, 1);
    expect(lockedError).toBeLessThan(gridError);
    // And by a wide margin, not a rounding difference.
    expect(gridError / lockedError).toBeGreaterThan(3);
  });

  it('falls back to a fixed grid, at the requested tempo, when detection fails', () => {
    const tone = Float32Array.from(
      { length: SR * 15 },
      (_, i) => Math.sin((2 * Math.PI * 440 * i) / SR) * 0.5,
    );
    const analysis = detectBeats(tone, { sampleRate: SR });
    const config = settings();
    const plan = planMix(analysis, config);

    expect(plan.beatLocked).toBe(false);
    expect(plan.playbackRate).toBe(1);
    expect(plan.effectiveBpm).toBe(TARGET);

    const clicks = planClicks(plan, analysis, config, 15);
    expect(Math.abs(periodErrorMs(clicks, TARGET))).toBeLessThan(0.001);
  });

  it('applies the nudge on top of a beat-locked grid', () => {
    const { signal } = synthTrack({ bpm: 85, seconds: 20 });
    const analysis = detectBeats(signal, { sampleRate: SR });
    const plain = planClicks(planMix(analysis, settings()), analysis, settings(), 20);
    const nudgedConfig = settings({ nudgeMs: 60 });
    const nudged = planClicks(planMix(analysis, nudgedConfig), analysis, nudgedConfig, 20);

    for (let k = 1; k < Math.min(plain.length, nudged.length) - 1; k++) {
      expect(nudged[k] - plain[k]).toBeCloseTo(0.06, 6);
    }
  });

  it('snapping abandons the stretch and clicks on the song instead', () => {
    const { signal, trueBeats } = synthTrack({ bpm: 128, seconds: 30 });
    const analysis = detectBeats(signal, { sampleRate: SR });
    const config = settings({ snap: true });
    const plan = planMix(analysis, config);

    expect(plan.playbackRate).toBe(1);
    expect(plan.effectiveBpm).toBeCloseTo(192, 0);

    const clicks = planClicks(plan, analysis, config, 30);
    // Unstretched, so the clicks sit on the song's untouched beats.
    const stretchedBeats = trueBeats;
    for (let k = 6; k < clicks.length - 6; k += 3) {
      const nearest = Math.min(...stretchedBeats.map((b) => Math.abs(clicks[k] - b)));
      expect(nearest).toBeLessThan(0.035);
    }
  });
});
