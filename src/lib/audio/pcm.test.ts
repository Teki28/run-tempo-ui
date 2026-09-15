import { describe, expect, it } from 'vitest';
import { concatBytes, floatToInt16 } from './pcm';

describe('floatToInt16', () => {
  it('maps silence and full scale', () => {
    const out = floatToInt16(new Float32Array([0, 1, -1]));
    expect(Array.from(out)).toEqual([0, 32767, -32768]);
  });

  it('clamps overshoot instead of wrapping', () => {
    // The metronome runs up to 500%, so the mix genuinely reaches these values.
    // A bare Int16Array assignment truncates modulo 2^16: 2.0 would land on -2,
    // turning the loudest part of the click into near-silence with a flipped
    // sign. Clipping to full scale is the only acceptable degradation.
    const out = floatToInt16(new Float32Array([2, -2, 5, -5, 1e6]));
    expect(Array.from(out)).toEqual([32767, -32768, 32767, -32768, 32767]);
  });

  it('stays monotonic across the range', () => {
    const out = floatToInt16(new Float32Array([-1, -0.5, 0, 0.5, 1]));
    for (let i = 1; i < out.length; i++) {
      expect(out[i]).toBeGreaterThan(out[i - 1]);
    }
  });

  it('preserves length', () => {
    expect(floatToInt16(new Float32Array(1152)).length).toBe(1152);
  });
});

describe('concatBytes', () => {
  it('joins fragments in order', () => {
    const joined = concatBytes([new Uint8Array([1, 2]), new Uint8Array([]), new Uint8Array([3])]);
    expect(Array.from(joined)).toEqual([1, 2, 3]);
  });

  it('preserves the bit pattern of signed fragments', () => {
    // lamejs has historically returned Int8Array from encodeBuffer; -1 must
    // land as byte 0xFF rather than being clamped to 0.
    expect(Array.from(concatBytes([new Int8Array([-1, -128])]))).toEqual([255, 128]);
  });

  it('returns an empty buffer for no input', () => {
    expect(concatBytes([]).length).toBe(0);
  });
});
