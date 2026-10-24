import { describe, expect, it } from 'vitest';
import { frameToSeconds, onsetEnvelope, strengthAt } from './onset';

const RATE = 11025;

/** Percussive bursts at a fixed interval, as a test signal. */
function impulseTrain(bpm: number, seconds: number, rate = RATE): Float32Array {
  const signal = new Float32Array(Math.round(seconds * rate));
  let seed = 99;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5;
  const period = 60 / bpm;
  for (let t = 0; t < seconds; t += period) {
    const start = Math.round(t * rate);
    for (let i = 0; i < rate * 0.03 && start + i < signal.length; i++) {
      signal[start + i] += Math.exp(-i / (rate * 0.005)) * rnd() * 2;
    }
  }
  return signal;
}

describe('onsetEnvelope', () => {
  it('peaks on the impulses and not between them', () => {
    const bpm = 120;
    const seconds = 10;
    const envelope = onsetEnvelope(impulseTrain(bpm, seconds), RATE);
    const period = 60 / bpm;

    const onBeat: number[] = [];
    const offBeat: number[] = [];
    // Skip the first beat: its envelope frame is reconstructed, not measured.
    for (let t = period; t < seconds - period; t += period) {
      onBeat.push(t);
      offBeat.push(t + period / 2);
    }
    expect(strengthAt(envelope, onBeat)).toBeGreaterThan(strengthAt(envelope, offBeat) + 1);
  });

  it('reports a frame rate matching the hop', () => {
    const envelope = onsetEnvelope(new Float32Array(RATE * 2), RATE, 1024, 128);
    expect(envelope.frameRate).toBeCloseTo(RATE / 128, 9);
  });

  it('is normalised to roughly zero mean and unit deviation', () => {
    const { strength } = onsetEnvelope(impulseTrain(128, 20), RATE);
    const mean = strength.reduce((a, b) => a + b, 0) / strength.length;
    const sd = Math.sqrt(
      strength.reduce((a, b) => a + (b - mean) ** 2, 0) / strength.length,
    );
    expect(mean).toBeCloseTo(0, 5);
    expect(sd).toBeCloseTo(1, 5);
  });

  it('does not let the first frame dominate', () => {
    // A raw flux computation makes frame 0 the whole spectrum appearing from
    // silence, which is always the largest value and biases phase towards t=0.
    const { strength } = onsetEnvelope(impulseTrain(120, 10), RATE);
    const max = Math.max(...strength);
    expect(strength[0]).toBeLessThan(max);
  });

  it('is insensitive to overall level', () => {
    // Two masterings of the same track must detect identically.
    const quiet = impulseTrain(120, 10);
    const a = onsetEnvelope(quiet, RATE).strength;
    for (const gain of [0.05, 0.5, 8]) {
      const b = onsetEnvelope(Float32Array.from(quiet, (s) => s * gain), RATE).strength;
      for (let i = 0; i < a.length; i++) expect(b[i]).toBeCloseTo(a[i], 4);
    }
  });

  it('timestamps frames at their window centre', () => {
    const envelope = onsetEnvelope(new Float32Array(RATE), RATE, 256, 128);
    expect(envelope.frameOffsetSec).toBeCloseTo(128 / RATE, 10);
    expect(frameToSeconds(10, envelope)).toBeCloseTo((10 * 128 + 128) / RATE, 10);
  });

  it('locates a lone impulse within one hop of the truth', () => {
    // The measurement that set the frame size: timestamping by window start
    // instead of centre puts this 82ms early at a 1024-sample frame.
    const at = 0.4536;
    const signal = new Float32Array(16384);
    let seed = 5;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5;
    const start = Math.round(at * RATE);
    for (let i = 0; i < RATE * 0.03; i++) signal[start + i] = Math.exp(-i / (RATE * 0.005)) * rnd() * 2;

    const envelope = onsetEnvelope(signal, RATE);
    let best = -Infinity;
    let bestFrame = 0;
    for (let f = 1; f < envelope.strength.length; f++) {
      if (envelope.strength[f] > best) {
        best = envelope.strength[f];
        bestFrame = f;
      }
    }
    expect(frameToSeconds(bestFrame, envelope)).toBeCloseTo(at, 2);
  });

  it('returns an empty envelope for a signal shorter than one frame', () => {
    expect(onsetEnvelope(new Float32Array(100), RATE, 1024, 128).strength).toHaveLength(0);
  });

  it('handles digital silence without producing NaN', () => {
    const { strength } = onsetEnvelope(new Float32Array(RATE), RATE);
    expect(strength.every(Number.isFinite)).toBe(true);
  });
});
