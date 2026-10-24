import { SimpleFilter, SoundTouch } from 'soundtouchjs';

/** Frames pulled from the pipeline per iteration. */
const CHUNK = 8192;

/**
 * Frames of silence appended to the source so the pipeline can drain.
 *
 * SoundTouch holds a tail inside its overlap buffers and will not release it
 * once the source runs dry: measured against a 2s source it comes up 9-12k
 * frames short across the factors this app uses. Feeding silence past the end
 * pushes that tail out; the output is trimmed to the exact target length
 * afterwards, so the padding never reaches the listener.
 */
const FLUSH_PAD = 16384;

export interface StretchRequest {
  /** One Float32Array per channel, all the same length. */
  channels: Float32Array[];
  /**
   * Output duration multiplier. 1/playbackRate — a playbackRate of 0.92
   * (slower) means the output is 1/0.92 longer, so `factor` is 1.087.
   */
  factor: number;
  onProgress?: (fraction: number) => void;
}

/**
 * Feeds SoundTouch from raw channel arrays.
 *
 * Deliberately not `WebAudioBufferSource`, which needs an AudioBuffer:
 * AudioBuffer does not exist in a Worker, and stretching a four-minute track
 * is exactly the work that must not run on the main thread. SoundTouch wants
 * interleaved stereo regardless of the real channel count, so a mono source
 * duplicates into both sides and the result is read back from one.
 */
class ChannelSource {
  private readonly left: Float32Array;
  private readonly right: Float32Array;
  private readonly frames: number;

  constructor(channels: Float32Array[]) {
    this.left = channels[0];
    this.right = channels.length > 1 ? channels[1] : channels[0];
    this.frames = channels[0].length + FLUSH_PAD;
  }

  get dualChannel(): boolean {
    return true;
  }

  extract(target: Float32Array, numFrames: number, position: number): number {
    const available = Math.max(0, Math.min(numFrames, this.frames - position));
    const real = this.left.length;
    for (let i = 0; i < available; i++) {
      const index = position + i;
      // Silence past the real end: this is the flush padding.
      target[i * 2] = index < real ? this.left[index] : 0;
      target[i * 2 + 1] = index < real ? this.right[index] : 0;
    }
    return available;
  }
}

/**
 * Time-stretch without changing pitch.
 *
 * SoundTouch rather than Rubber Band for licensing reasons (LGPL against
 * GPL-only), which costs nothing here: the app never asks for more than about
 * 10%, and small ratios are where SoundTouch is transparent. Rubber Band's
 * advantage appears at the extreme ratios this never reaches.
 */
export function stretchChannels({ channels, factor, onProgress }: StretchRequest): Float32Array[] {
  if (channels.length === 0) throw new RangeError('no channels to stretch');
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new RangeError(`factor must be a positive number, got ${factor}`);
  }

  const inputFrames = channels[0].length;
  const outChannels = Math.min(2, channels.length);
  if (inputFrames === 0) return channels.slice(0, outChannels).map(() => new Float32Array(0));

  // factor is an output-duration multiplier; SoundTouch's `tempo` is a rate,
  // so it is the reciprocal. tempo 1.087 would make the output *shorter*.
  const soundtouch = new SoundTouch();
  soundtouch.tempo = 1 / factor;

  const filter = new SimpleFilter(new ChannelSource(channels), soundtouch);

  const expected = Math.round(inputFrames * factor);
  const out: Float32Array[] = Array.from(
    { length: outChannels },
    () => new Float32Array(expected),
  );

  const interleaved = new Float32Array(CHUNK * 2);
  let written = 0;

  while (written < expected) {
    const frames = filter.extract(interleaved, CHUNK);
    if (frames === 0) break;

    const room = Math.min(frames, expected - written);
    for (let i = 0; i < room; i++) {
      out[0][written + i] = interleaved[i * 2];
      if (outChannels > 1) out[1][written + i] = interleaved[i * 2 + 1];
    }
    written += room;
    onProgress?.(Math.min(1, written / expected));
  }
  onProgress?.(1);

  // With the flush padding above, `expected` is always reached. Trim anyway
  // rather than hand back a buffer with a silent tail, which would read as a
  // glitch at the end of a download.
  return written < expected ? out.map((channel) => channel.subarray(0, written)) : out;
}
