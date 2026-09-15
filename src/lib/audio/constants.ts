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
