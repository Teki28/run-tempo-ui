/**
 * Convert Float32 PCM to signed 16-bit, clamping out-of-range samples.
 *
 * The clamp is load-bearing: the metronome gain goes up to 500%, so the mixed
 * signal routinely exceeds ±1.0. Int16Array assignment truncates modulo 2^16,
 * which turns a loud click into full-scale noise of the opposite sign. Clamping
 * first degrades gracefully into ordinary hard clipping instead.
 */
export function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = input[i];
    if (s >= 1) out[i] = 32767;
    else if (s <= -1) out[i] = -32768;
    else out[i] = Math.round(s < 0 ? s * 32768 : s * 32767);
  }
  return out;
}

/** Join encoded MP3 fragments into one contiguous buffer. */
export function concatBytes(parts: ArrayLike<number>[]): Uint8Array {
  let length = 0;
  for (const part of parts) length += part.length;
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part as Uint8Array, offset);
    offset += part.length;
  }
  return out;
}
