import { CLICK_URL } from './constants';
import { fetchAndDecode } from './decode';

let pending: Promise<AudioBuffer> | null = null;

/**
 * The metronome tick, fetched and decoded once per session.
 *
 * public/audio/click.wav is the tick extracted from the old API's base-1.wav
 * with its 109ms of leading silence removed. That trim matters: the sample is
 * scheduled directly on the beat, so any leading silence would put every click
 * uniformly late.
 */
export function loadClick(): Promise<AudioBuffer> {
  if (!pending) {
    pending = fetchAndDecode(CLICK_URL);
    // Don't cache a rejection — a transient network failure should be retryable.
    pending.catch(() => {
      pending = null;
    });
  }
  return pending;
}
