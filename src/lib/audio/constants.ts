/** Everything is decoded and rendered at this rate, matching the old API's
 *  AudioService.STANDARD_SAMPLE_RATE so output is bit-comparable to before. */
export const SAMPLE_RATE = 44100;

export const MP3_BITRATE_KBPS = 192;

/** MP3 frames are 1152 samples; feeding the encoder in exact frames avoids
 *  internal buffering churn. */
export const MP3_BLOCK_SIZE = 1152;

export const CLICK_URL = '/audio/click.wav';
export const SAMPLE_MUSIC_URL = '/audio/sample-preview.mp3';

/** Length of the quick-audition render, unchanged from the API's preview. */
export const PREVIEW_SECONDS = 10;

export const MAX_FILES = 5;

/** Was 10MB when every byte crossed the network. Now the only real limit is
 *  how much PCM the tab can hold, and we process one file at a time. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Formats we let the user pick, in react-dropzone's accept shape. The browser
 *  decodes all of these; M4A/AAC availability varies by platform, which
 *  decodeAudioFile reports as an UnsupportedAudioError. */
export const ACCEPTED_AUDIO: Record<string, string[]> = {
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'audio/x-wav': ['.wav'],
  'audio/mp4': ['.m4a'],
  'audio/x-m4a': ['.m4a'],
};

/** Beat detection runs on a mono copy decimated to a quarter rate. Percussive
 *  onsets are broadband and fully legible below ~5kHz, so the top octave buys
 *  nothing; dropping it cuts both the FFT work and the analysis working set by
 *  4x. Owning the detector is what makes this safe — a third-party tracker
 *  tuned for 44.1kHz would just report a proportionally wrong tempo. */
export const ANALYSIS_DECIMATION = 4;
export const ANALYSIS_SAMPLE_RATE = SAMPLE_RATE / ANALYSIS_DECIMATION;

/** STFT geometry for the onset envelope, in analysis-rate samples.
 *
 *  The hop gives ~86 frames/sec (11.6ms), fine enough to place a beat well
 *  inside the window a listener would call "on time". The frame is deliberately
 *  short: spectral flux fires as an onset *enters* the window, so a long window
 *  reports every onset early. Measured against a known impulse, the lead when
 *  frames are timestamped at their centres is 0.7ms at 256 and 36ms at 1024 —
 *  so 256 it is, and 43Hz of frequency resolution is ample for summing flux. */
export const ONSET_FRAME_SIZE = 256;
/** Stays at 128 despite the hop being the grid beat times quantise to.
 *  Halving it to 64 looks like the obvious cure for that jitter and is not:
 *  with 75% window overlap the flux rise spreads across more frames, each
 *  smaller, and the measured lead against a known impulse degrades from 0.7ms
 *  to 6.5ms — it also brought back the half-tempo reading on a 174 BPM track.
 *  Sub-frame precision comes from interpolating the envelope peak in
 *  `track.ts` instead, which costs one parabola per beat. */
export const ONSET_HOP_SIZE = 128;

/** Tempo search range, in BPM. Wider than any plausible running cadence
 *  because the song's own tempo may be half or double it. */
export const MIN_DETECT_BPM = 50;
export const MAX_DETECT_BPM = 210;

/** Multiples of the song's own beat rate we are willing to click on. An 85 BPM
 *  song reaches a 170 cadence at x2 with no stretching; 1.5 covers the
 *  three-against-two cases. Widening this to 3 or 4 is a one-line change. */
export const CLICK_RATIOS = [0.5, 1, 1.5, 2] as const;

/** Largest tempo change we will apply to the music, as a percentage. Past
 *  roughly 10% the stretch stops being transparent and starts sounding wrong. */
export const DEFAULT_MAX_STRETCH_PCT = 8;

/** Range of the manual phase correction, in milliseconds either way. */
export const MAX_NUDGE_MS = 250;

/** Detected tempi are folded into this band before being shown to the user, so
 *  a half-tempo reading of a 174 BPM track is not reported as 87. */
export const CANONICAL_BPM_MIN = 70;
export const CANONICAL_BPM_MAX = 180;
