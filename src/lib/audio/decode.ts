import { SAMPLE_RATE } from './constants';

/** Thrown when the browser has no decoder for the file the user picked. */
export class UnsupportedAudioError extends Error {
  constructor(public readonly filename: string, cause?: unknown) {
    super(`Could not decode "${filename}"`);
    this.name = 'UnsupportedAudioError';
    this.cause = cause;
  }
}

/**
 * A throwaway context used only as a decoding target. OfflineAudioContext is
 * deliberate: constructing a live AudioContext before a user gesture trips the
 * browser autoplay policy and logs a warning, and we don't need an output here.
 *
 * decodeAudioData resamples to the context's rate, so every buffer in the app
 * comes back at SAMPLE_RATE regardless of what the source file was recorded at.
 */
function decodingContext(): OfflineAudioContext {
  return new OfflineAudioContext(1, 1, SAMPLE_RATE);
}

export async function decodeAudioBytes(bytes: ArrayBuffer, label: string): Promise<AudioBuffer> {
  try {
    return await decodingContext().decodeAudioData(bytes);
  } catch (cause) {
    throw new UnsupportedAudioError(label, cause);
  }
}

/**
 * Decode a user-selected file to PCM.
 *
 * MP3 and WAV decode everywhere. M4A/AAC depends on the platform decoders the
 * browser exposes, which is why the caller needs a real error to show rather
 * than a generic failure.
 */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  return decodeAudioBytes(await file.arrayBuffer(), file.name);
}

export async function fetchAndDecode(url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }
  return decodeAudioBytes(await response.arrayBuffer(), url);
}
