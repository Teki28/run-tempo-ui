/** How often the scheduling loop wakes, in milliseconds. */
const TICK_MS = 25;

/** How far ahead of the clock clicks are committed, in seconds. */
const LOOKAHEAD_SEC = 0.12;

export interface PlaybackState {
  playing: boolean;
  /** Position within the music, in seconds. */
  position: number;
  duration: number;
}

export interface StartOptions {
  /** The music to play. Already stretched, if stretching was applied. */
  music: AudioBuffer;
  click: AudioBuffer;
  /** Click onsets in seconds on the music's timeline, ascending. */
  clicks: readonly number[];
  /** Click loudness as a percentage, 0-500. */
  volume: number;
  /** Where to start, in seconds. */
  offset?: number;
}

/**
 * Plays music with a metronome over it, scheduled against the audio clock.
 *
 * The clicks are committed a fraction of a second ahead of the hardware clock
 * by a timer that wakes every 25ms — the standard lookahead pattern. A timer
 * cannot be trusted to *fire* a click, because `setInterval` drifts by whole
 * tens of milliseconds under load and stops entirely in a backgrounded tab;
 * but it is perfectly adequate for deciding what to hand to the audio thread,
 * which then plays it at exactly the time requested.
 *
 * Because clicks are only committed 120ms out, changing the BPM, the nudge or
 * the volume takes effect almost immediately without restarting playback —
 * which is what lets the user tune the alignment while listening to it.
 */
export class ClickTrackPlayer {
  private ctx: AudioContext | null = null;
  private music: AudioBufferSourceNode | null = null;
  private clickGain: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Live clicks, kept sorted. Replaced wholesale when settings change. */
  private clicks: readonly number[] = [];
  private clickBuffer: AudioBuffer | null = null;
  private nextIndex = 0;

  /** Audio-clock time at which music position 0 occurred. */
  private originTime = 0;
  private startOffset = 0;
  private duration = 0;
  private scheduled: AudioBufferSourceNode[] = [];

  onStateChange: ((state: PlaybackState) => void) | null = null;

  /**
   * Whether a live AudioContext exists yet.
   *
   * iOS will not start one outside a user gesture, so construction is deferred
   * to the first play() — which must therefore be called synchronously from a
   * click handler, not after an await.
   */
  get started(): boolean {
    return this.ctx !== null;
  }

  get playing(): boolean {
    return this.music !== null;
  }

  /**
   * Create and unlock the AudioContext. Call this *synchronously* from a user
   * gesture, before any awaiting.
   *
   * Safari on iOS only lets an AudioContext leave the "suspended" state from
   * inside a gesture handler, and the permission is lost across an `await` —
   * so a flow that decodes or analyses before playing cannot simply call
   * play() at the end. It must prime here first. Once unlocked the context
   * stays unlocked, so the later play() is free to be asynchronous.
   *
   * Failure is silent by design: with no context the later play() is a no-op
   * rather than an exception thrown from a click handler.
   */
  prime(): void {
    try {
      void this.context().resume();
    } catch {
      // No Web Audio available; play() will no-op.
    }
  }

  get position(): number {
    if (!this.ctx) return this.startOffset;
    if (!this.music) return this.startOffset;
    return Math.min(this.duration, this.ctx.currentTime - this.originTime);
  }

  /**
   * Begin playback.
   *
   * Call this directly from the event handler of a user gesture. Safari on iOS
   * only allows an AudioContext to leave the "suspended" state inside one, and
   * an `await` before this point is enough to lose that permission — the
   * context then stays silent with no error raised.
   */
  play({ music, click, clicks, volume, offset = 0 }: StartOptions): void {
    this.stop();

    const ctx = this.context();
    // Required on iOS after construction and after any interruption (a call,
    // the ring switch, a backgrounded tab). Harmless when already running.
    void ctx.resume();

    this.clickBuffer = click;
    this.clicks = clicks;
    this.duration = music.duration;
    this.startOffset = Math.max(0, Math.min(offset, music.duration));

    this.clickGain = ctx.createGain();
    this.clickGain.gain.value = volume / 100;
    this.clickGain.connect(ctx.destination);

    const source = ctx.createBufferSource();
    source.buffer = music;
    source.connect(ctx.destination);
    source.onended = () => {
      // Fires on an explicit stop() too, so only treat it as the end of the
      // track when this source is still the current one.
      if (this.music === source) {
        this.stop();
        this.emit();
      }
    };

    // A small lead-in so the first scheduling tick has something to aim at
    // rather than racing the clock.
    const startAt = ctx.currentTime + 0.05;
    source.start(startAt, this.startOffset);
    this.music = source;
    this.originTime = startAt - this.startOffset;

    this.nextIndex = this.firstIndexAfter(this.startOffset);
    this.timer = setInterval(() => this.pump(), TICK_MS);
    this.pump();
    this.emit();
  }

  /** Stop playback and release the nodes. The context is kept for reuse. */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.music) {
      const source = this.music;
      this.music = null;
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Already stopped; nothing to do.
      }
      source.disconnect();
    }
    this.dropScheduled();
    this.clickGain?.disconnect();
    this.clickGain = null;
  }

  /** Change click loudness without interrupting playback. */
  setVolume(volume: number): void {
    if (!this.clickGain || !this.ctx) return;
    // A short ramp rather than a jump: an abrupt gain change on a ringing
    // click is an audible tick of its own.
    this.clickGain.gain.setTargetAtTime(volume / 100, this.ctx.currentTime, 0.01);
  }

  /**
   * Replace the click grid mid-playback.
   *
   * Clicks already committed to the audio thread are stopped and rescheduled,
   * so a nudge or BPM change is heard within a tick rather than at the end of
   * the track.
   */
  setClicks(clicks: readonly number[]): void {
    this.clicks = clicks;
    if (!this.ctx || !this.music) return;
    this.dropScheduled();
    this.nextIndex = this.firstIndexAfter(this.position);
    this.pump();
  }

  /** Release the audio context entirely. */
  dispose(): void {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }

  private context(): AudioContext {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
    }
    return this.ctx;
  }

  /** Index of the first click at or after a music position. */
  private firstIndexAfter(position: number): number {
    let lo = 0;
    let hi = this.clicks.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.clicks[mid] < position) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  private dropScheduled(): void {
    for (const source of this.scheduled) {
      try {
        source.stop();
      } catch {
        // Already finished.
      }
      source.disconnect();
    }
    this.scheduled = [];
  }

  /** Commit every click falling inside the lookahead window. */
  private pump(): void {
    const ctx = this.ctx;
    const gain = this.clickGain;
    if (!ctx || !gain || !this.clickBuffer || !this.music) return;

    const horizon = ctx.currentTime + LOOKAHEAD_SEC;

    while (this.nextIndex < this.clicks.length) {
      const when = this.originTime + this.clicks[this.nextIndex];
      if (when > horizon) break;
      this.nextIndex++;

      // A click whose time has already passed is dropped rather than fired
      // late: a late click is worse than a missing one when the whole point is
      // alignment. This only happens after a stall of more than a tick.
      if (when < ctx.currentTime) continue;

      const source = ctx.createBufferSource();
      source.buffer = this.clickBuffer;
      source.connect(gain);
      source.start(when);
      source.onended = () => {
        source.disconnect();
        const at = this.scheduled.indexOf(source);
        if (at >= 0) this.scheduled.splice(at, 1);
      };
      this.scheduled.push(source);
    }

    this.emit();
  }

  private emit(): void {
    this.onStateChange?.({
      playing: this.playing,
      position: this.position,
      duration: this.duration,
    });
  }
}
