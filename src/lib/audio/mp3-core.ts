import { Mp3Encoder } from '@breezystack/lamejs';
import { MP3_BLOCK_SIZE } from './constants';
import { concatBytes } from './pcm';

/** How often the encoder reports back, in MP3 frames (~6s of audio). */
const PROGRESS_EVERY_BLOCKS = 256;

export interface Mp3Stream {
  /**
   * Append PCM. Call repeatedly to concatenate several tracks into one file —
   * a single encoder instance keeps the bitrate and frame alignment consistent
   * across the join, which is what makes the merge-to-one download seamless.
   */
  encode(left: Int16Array, right: Int16Array | null, onProgress?: (samplesDone: number) => void): void;
  /** Flush the encoder's tail and return the complete MP3. */
  finish(): Uint8Array;
}

export function createStream(channels: number, sampleRate: number, kbps: number): Mp3Stream {
  const encoder = new Mp3Encoder(channels, sampleRate, kbps);
  const parts: ArrayLike<number>[] = [];

  return {
    encode(left, right, onProgress) {
      const total = left.length;
      let block = 0;

      for (let i = 0; i < total; i += MP3_BLOCK_SIZE) {
        const l = left.subarray(i, i + MP3_BLOCK_SIZE);
        const chunk =
          right && channels === 2
            ? encoder.encodeBuffer(l, right.subarray(i, i + MP3_BLOCK_SIZE))
            : encoder.encodeBuffer(l);

        if (chunk.length > 0) parts.push(chunk);

        if (onProgress && ++block % PROGRESS_EVERY_BLOCKS === 0) {
          onProgress(Math.min(i + MP3_BLOCK_SIZE, total));
        }
      }

      onProgress?.(total);
    },

    finish() {
      const tail = encoder.flush();
      if (tail.length > 0) parts.push(tail);
      return concatBytes(parts);
    },
  };
}
