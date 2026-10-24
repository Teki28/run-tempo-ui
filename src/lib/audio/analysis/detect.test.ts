import { describe, expect, it } from 'vitest';
import { MIN_BEAT_STRENGTH, MIN_PERIODICITY, detectBeats, isUsable } from './detect';

const SR = 44100;

/**
 * A synthetic track with a kick/snare/hat pattern.
 *
 * Deliberately not a bare impulse train: the point of several of these tests
 * is how the tracker behaves when there is energy *between* the beats, which
 * is the normal case in recorded music and the source of octave errors.
 */
function synthTrack(options: {
  bpm: number;
  seconds: number;
  /** Fractional tempo increase across the whole track. */
  drift?: number;
  /** Add an offbeat hi-hat on every eighth. */
  hats?: boolean;
  /** Seconds of silence before the first beat. */
  leadIn?: number;
  gain?: number;
}): Float32Array {
  const { bpm, seconds, drift = 0, hats = false, leadIn = 0, gain = 1 } = options;
  const signal = new Float32Array(Math.round(seconds * SR));
  let seed = 2463534242;
  const rnd = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296 - 0.5;
  };

  const hit = (at: number, level: number, decay: number, tone: number) => {
    const start = Math.round(at * SR);
    const length = Math.round(SR * decay * 5);
    for (let i = 0; i < length; i++) {
      const idx = start + i;
      if (idx < 0 || idx >= signal.length) break;
      const env = Math.exp(-i / (SR * decay));
      signal[idx] +=
        gain * level * env * (rnd() * 0.6 + Math.sin((2 * Math.PI * tone * i) / SR) * 0.7);
    }
  };

  let t = leadIn;
  let beat = 0;
  while (t < seconds) {
    const bar = beat % 4;
    if (bar === 0) hit(t, 1.0, 0.05, 55);
    else if (bar === 2) hit(t, 0.8, 0.04, 200);
    else hit(t, 0.55, 0.03, 150);

    const instant = bpm * (1 + drift * (t / seconds));
    const period = 60 / instant;
    if (hats) hit(t + period / 2, 0.25, 0.012, 6000);
    t += period;
    beat++;
  }
  return signal;
}

/** Mean absolute distance from each true beat to the nearest detected one. */
function phaseError(detected: readonly number[], bpm: number, seconds: number, leadIn = 0) {
  const period = 60 / bpm;
  let total = 0;
  let count = 0;
  for (let t = leadIn + period; t < seconds - period; t += period) {
    let nearest = Infinity;
    for (const d of detected) nearest = Math.min(nearest, Math.abs(d - t));
    total += nearest;
    count++;
  }
  return total / count;
}

describe('detectBeats', () => {
  it('reads a steady EDM track and lands on its beats', () => {
    const analysis = detectBeats(synthTrack({ bpm: 128, seconds: 30 }), { sampleRate: SR });
    expect(analysis).not.toBeNull();
    expect(analysis!.bpm).toBeCloseTo(128, 0);
    expect(isUsable(analysis)).toBe(true);
    // Within 25ms of every true beat.
    expect(phaseError(analysis!.beats, 128, 30)).toBeLessThan(0.025);
  });

  it('reads a slow 85 BPM track without halving or doubling it', () => {
    const analysis = detectBeats(synthTrack({ bpm: 85, seconds: 30 }), { sampleRate: SR });
    expect(analysis).not.toBeNull();
    expect(analysis!.bpm).toBeCloseTo(85, 0);
    expect(phaseError(analysis!.beats, 85, 30)).toBeLessThan(0.03);
  });

  it('follows a track that speeds up', () => {
    // 124 drifting to ~136 over 40s. A fixed grid cannot stay with this.
    const seconds = 40;
    const analysis = detectBeats(synthTrack({ bpm: 124, seconds, drift: 0.097 }), {
      sampleRate: SR,
    });
    expect(analysis).not.toBeNull();
    expect(isUsable(analysis)).toBe(true);

    const beats = analysis!.beats;
    const gapAt = (i: number) => beats[i + 1] - beats[i];
    const earlyBpm = 60 / gapAt(2);
    const lateBpm = 60 / gapAt(beats.length - 3);
    expect(earlyBpm).toBeGreaterThan(118);
    expect(earlyBpm).toBeLessThan(130);
    expect(lateBpm).toBeGreaterThan(earlyBpm + 5);
    expect(analysis!.drift).toBeGreaterThan(0.01);
  });

  it('finds the phase of a song that does not start on beat one', () => {
    // The specific failure this whole change exists to fix.
    const leadIn = 0.37;
    const analysis = detectBeats(synthTrack({ bpm: 120, seconds: 30, leadIn }), {
      sampleRate: SR,
    });
    expect(analysis).not.toBeNull();
    expect(phaseError(analysis!.beats, 120, 30, leadIn)).toBeLessThan(0.03);
    // And the first beat is near the music, not near t=0.
    expect(analysis!.beats[0]).toBeGreaterThan(0.2);
  });

  it('stays on the beat when a track has offbeat hats', () => {
    // Energy between the beats is the usual cause of a doubled reading.
    const analysis = detectBeats(synthTrack({ bpm: 90, seconds: 30, hats: true }), {
      sampleRate: SR,
    });
    expect(analysis).not.toBeNull();
    expect(analysis!.bpm).toBeCloseTo(90, 0);
    expect(isUsable(analysis)).toBe(true);
    // The beats carry decisively more onset energy than the midpoints.
    expect(analysis!.beatStrength).toBeGreaterThan(analysis!.subdivisionStrength + 1);
  });

  it('does not halve a fast track', () => {
    // 174 is where third-party trackers commonly report exactly 87, placing
    // beats on every other real beat.
    const analysis = detectBeats(synthTrack({ bpm: 174, seconds: 30 }), { sampleRate: SR });
    expect(analysis).not.toBeNull();
    expect(analysis!.bpm).toBeCloseTo(174, 0);
    expect(phaseError(analysis!.beats, 174, 30)).toBeLessThan(0.02);
  });

  it('detects identically at any mastering level', () => {
    const loud = detectBeats(synthTrack({ bpm: 128, seconds: 20, gain: 1 }), { sampleRate: SR });
    const quiet = detectBeats(synthTrack({ bpm: 128, seconds: 20, gain: 0.02 }), {
      sampleRate: SR,
    });
    expect(quiet!.bpm).toBeCloseTo(loud!.bpm, 6);
    expect(quiet!.beats.length).toBe(loud!.beats.length);
  });

  it('gives up rather than guessing on silence', () => {
    const analysis = detectBeats(new Float32Array(SR * 10), { sampleRate: SR });
    expect(isUsable(analysis)).toBe(false);
  });

  it('gives up on a clip too short to hold a beat', () => {
    expect(isUsable(detectBeats(new Float32Array(1000), { sampleRate: SR }))).toBe(false);
  });

  it('refuses white noise', () => {
    // xorshift32, not a masked LCG: the latter has short low-bit periods and
    // yields a genuinely periodic signal, which this case must not contain.
    let seed = 2463534242;
    const noise = Float32Array.from({ length: SR * 15 }, () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 4294967296 - 0.5;
    });
    const analysis = detectBeats(noise, { sampleRate: SR });
    expect(isUsable(analysis)).toBe(false);
    expect(analysis!.confidence).toBeLessThan(MIN_PERIODICITY);
  });

  it('refuses a sustained tone, which periodicity alone would accept', () => {
    // No onsets at all, so the envelope is near-constant and normalising it
    // amplifies ripple into something that self-correlates at 0.96. The low
    // beat strength is what catches it.
    const tone = Float32Array.from(
      { length: SR * 15 },
      (_, i) => Math.sin((2 * Math.PI * 440 * i) / SR) * 0.5,
    );
    const analysis = detectBeats(tone, { sampleRate: SR });
    expect(isUsable(analysis)).toBe(false);
    expect(analysis!.beatStrength).toBeLessThan(MIN_BEAT_STRENGTH);
  });

  it('refuses energetic material that has no tempo', () => {
    // Irregular bursts: plenty of onset strength, no periodicity. The mirror
    // image of the sustained tone, and why both checks are needed.
    let seed = 99991;
    const next = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 4294967296;
    };
    const signal = new Float32Array(SR * 20);
    for (let t = 0.2; t < 19; t += 0.18 + next() * 0.5) {
      const start = Math.round(t * SR);
      for (let i = 0; i < SR * 0.12 && start + i < signal.length; i++) {
        signal[start + i] = Math.exp(-i / (SR * 0.04)) * (next() - 0.5);
      }
    }
    const analysis = detectBeats(signal, { sampleRate: SR });
    expect(isUsable(analysis)).toBe(false);
  });

  it('reports progress through every stage', () => {
    const stages: string[] = [];
    detectBeats(synthTrack({ bpm: 120, seconds: 8 }), {
      sampleRate: SR,
      onProgress: (stage) => {
        if (!stages.includes(stage)) stages.push(stage);
      },
    });
    expect(stages).toEqual(['decimating', 'onsets', 'tempo', 'tracking']);
  });
});
