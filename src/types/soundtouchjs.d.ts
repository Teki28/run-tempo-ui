/**
 * Minimal declarations for the parts of soundtouchjs this app uses.
 *
 * The package ships no types. Declaring the real shape rather than
 * `declare module 'soundtouchjs'` keeps the stretch code type-checked — the
 * tempo/rate/pitch setters are easy to confuse, and `tempo` being a rate while
 * our own factor is a duration multiplier is exactly the kind of mix-up worth
 * having the compiler catch.
 */
declare module 'soundtouchjs' {
  /** A source of interleaved stereo frames for SimpleFilter to pull from. */
  export interface SoundTouchSource {
    readonly dualChannel: boolean;
    /** Fill `target` with `numFrames` interleaved frames from `position`.
     *  Returns how many frames were actually written. */
    extract(target: Float32Array, numFrames: number, position: number): number;
  }

  export class SoundTouch {
    /** Playback rate as a multiplier, pitch-preserving. >1 is faster. */
    tempo: number;
    rate: number;
    pitch: number;
    pitchSemitones: number;
    pitchOctaves: number;
    clear(): void;
  }

  export class SimpleFilter {
    constructor(source: SoundTouchSource, pipe: SoundTouch, callback?: () => void);
    /** Frames consumed from the source so far. */
    readonly sourcePosition: number;
    position: number;
    historyBufferSize: number;
    /** Pull up to `numFrames` processed interleaved frames. 0 means drained. */
    extract(target: Float32Array, numFrames: number): number;
    clear(): void;
  }

  export class PitchShifter {
    constructor(context: BaseAudioContext, buffer: AudioBuffer, bufferSize: number);
    tempo: number;
    pitch: number;
  }
}
