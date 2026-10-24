import { SAMPLE_RATE } from './constants';

export interface RenderOptions {
  /** Exact click onsets in seconds, relative to the start of the output. */
  clicks: readonly number[];
  /** Click loudness as a percentage, 0-500. 100 is unity. */
  volume: number;
  /** Render only the first N seconds. Omit for the whole track. */
  durationSec?: number;
}

/**
 * Mix a metronome click over `source` and render the result.
 *
 * Takes click *times*, not a BPM. Computing the grid here is what tied the
 * click to a fixed interval starting at t=0, which is wrong for any song whose
 * first beat is not at zero and for every song whose tempo moves. The caller
 * now derives times from the song's detected beats; this just places them.
 */
export async function renderWithMetronome(
  source: AudioBuffer,
  click: AudioBuffer,
  { clicks, volume, durationSec }: RenderOptions,
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

  if (volume > 0 && clicks.length > 0) {
    const gain = ctx.createGain();
    // The old API applied 20*log10(volume/100) dB to the click. Adding X dB is
    // multiplying by 10^(X/20), which collapses back to exactly volume/100.
    gain.gain.value = volume / 100;
    gain.connect(ctx.destination);

    for (const time of clicks) {
      if (time < 0 || time >= duration) continue;
      const tick = ctx.createBufferSource();
      tick.buffer = click;
      tick.connect(gain);
      tick.start(time);
    }
  }

  return ctx.startRendering();
}
