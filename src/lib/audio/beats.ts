/**
 * Beat onsets, in seconds, for a track of `durationSec` at `bpm`.
 *
 * Times are computed as `i * interval` rather than accumulated, so a long track
 * at an awkward tempo doesn't drift audibly late by the final beat.
 */
export function beatTimes(bpm: number, durationSec: number): number[] {
  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new RangeError(`bpm must be a positive number, got ${bpm}`);
  }
  if (!Number.isFinite(durationSec) || durationSec <= 0) return [];

  const interval = 60 / bpm;
  const times: number[] = [];
  for (let i = 0; ; i++) {
    const t = i * interval;
    if (t >= durationSec) break;
    times.push(t);
  }
  return times;
}
