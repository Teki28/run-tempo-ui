import { beatTimes } from '../beats';

export interface ScheduleOptions {
  /** Detected beat onsets in seconds, on the *original* timeline, ascending. */
  beats: readonly number[];
  /** Clicks per detected beat. 2 puts one on every half-beat. */
  ratio: number;
  /** Stretch applied to the music. Beat times are divided by it. */
  playbackRate?: number;
  /** Manual phase correction in milliseconds. Positive moves clicks later. */
  nudgeMs?: number;
  /** Length of the output being filled, in seconds. */
  durationSec: number;
}

/** How many trailing intervals are averaged when running past the last beat. */
const TAIL_WINDOW = 4;

/**
 * Time of a fractional beat index, interpolating between real detected beats.
 *
 * Fractional indices are what make every ratio a single code path: x2 asks for
 * 0, 0.5, 1, 1.5 and lands on true beats and their midpoints, while x1.5 asks
 * for 0, 0.667, 1.333, 2 and gets three clicks across every two beats. Because
 * the in-between positions are interpolated from the neighbouring *detected*
 * beats rather than from a fixed interval, subdivided clicks follow the song's
 * tempo drift instead of walking away from it.
 */
function beatAt(beats: readonly number[], index: number, tailInterval: number): number {
  const last = beats.length - 1;
  if (index <= 0) return beats[0] + index * (beats.length > 1 ? beats[1] - beats[0] : tailInterval);

  const lower = Math.floor(index);
  const frac = index - lower;

  if (lower >= last) {
    // Past the tracker's last beat. Real detections often stop before the
    // audio does (fades, outros), and leaving the tail silent is worse than
    // continuing at the tempo the song ended on.
    return beats[last] + (index - last) * tailInterval;
  }
  if (frac === 0) return beats[lower];
  return beats[lower] + frac * (beats[lower + 1] - beats[lower]);
}

/** Mean of the final few beat intervals, used to extrapolate past the end. */
function tailInterval(beats: readonly number[]): number {
  if (beats.length < 2) return 0.5;
  const span = Math.min(TAIL_WINDOW, beats.length - 1);
  const first = beats[beats.length - 1 - span];
  return (beats[beats.length - 1] - first) / span;
}

/**
 * Where to put the clicks.
 *
 * Clicks land on the song's own beats (and interpolated subdivisions of them),
 * not on a grid computed from a BPM number. That is the whole point: a fixed
 * grid anchored at t=0 is only ever right for a song that starts exactly on
 * beat one and never drifts.
 */
export function clickTimes({
  beats,
  ratio,
  playbackRate = 1,
  nudgeMs = 0,
  durationSec,
}: ScheduleOptions): number[] {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new RangeError(`ratio must be a positive number, got ${ratio}`);
  }
  if (!Number.isFinite(playbackRate) || playbackRate <= 0) {
    throw new RangeError(`playbackRate must be a positive number, got ${playbackRate}`);
  }
  if (!Number.isFinite(durationSec) || durationSec <= 0) return [];
  if (beats.length === 0) return [];

  const tail = tailInterval(beats);
  const offset = nudgeMs / 1000;
  const times: number[] = [];

  for (let k = 0; ; k++) {
    // Stretching the music moves every beat: slowing it to rate 0.92 makes the
    // output 1/0.92 longer, so a beat at t lands at t / 0.92.
    const t = beatAt(beats, k / ratio, tail) / playbackRate + offset;
    if (t >= durationSec) break;
    if (t >= 0) times.push(t);

    // A ratio below 1 with a short beat list would otherwise spin forever
    // waiting for the extrapolation to reach the end.
    if (k > 1e7) break;
  }

  return times;
}

/**
 * The no-detection fallback: a fixed grid at the requested BPM.
 *
 * This is what the app did for every track before beat detection existed. It is
 * still the right answer when analysis fails or comes back unusable — a click
 * in the wrong phase beats no click at all — but it is a fallback, not a path
 * anything should take on purpose.
 */
export function fallbackClickTimes(bpm: number, durationSec: number, nudgeMs = 0): number[] {
  const offset = nudgeMs / 1000;
  return beatTimes(bpm, durationSec)
    .map((t) => t + offset)
    .filter((t) => t >= 0 && t < durationSec);
}
