import { beatTimes } from './beats';
import { SAMPLE_RATE } from './constants';

export interface RenderOptions {
  /** Beats per minute, 30-300 to match the UI slider. */
  bpm: number;
  /** Click loudness as a percentage, 0-500. 100 is unity. */
  volume: number;
  /** Render only the first N seconds. Omit for the whole track. */
  durationSec?: number;
}

/**
 * Mix a metronome click over `source` and render the result.
 *
 * The old API picked the nearest of eight pre-rendered click loops and resampled
 * it by target/base, which detuned the click at any BPM that wasn't one of the
 * eight. Scheduling one sample at computed beat times has no such constraint:
 * every BPM is exact and the click keeps its original pitch.
 */
export async function renderWithMetronome(
  source: AudioBuffer,
  click: AudioBuffer,
  { bpm, volume, durationSec }: RenderOptions,
): Promise<AudioBuffer> {
  const duration = Math.min(durationSec ?? source.duration, source.duration);
  if (duration <= 0) {
    throw new RangeError('Nothing to render: source audio is empty');
  }

  const channels = source.numberOfChannels >= 2 ? 2 : 1;
  const frames = Math.max(1, Math.ceil(duration * SAMPLE_RATE));
  const ctx = new OfflineAudioContext(channels, frames, SAMPLE_RATE);

  const song = ctx.createBufferSource();
  song.buffer = source;
  song.connect(ctx.destination);
  song.start(0);

  if (volume > 0) {
    const gain = ctx.createGain();
    // The API applied 20*log10(volume/100) dB to the click. Adding X dB is
    // multiplying by 10^(X/20), which collapses back to exactly volume/100.
    gain.gain.value = volume / 100;
    gain.connect(ctx.destination);

    for (const time of beatTimes(bpm, duration)) {
      const tick = ctx.createBufferSource();
      tick.buffer = click;
      tick.connect(gain);
      tick.start(time);
    }
  }

  return ctx.startRendering();
}
