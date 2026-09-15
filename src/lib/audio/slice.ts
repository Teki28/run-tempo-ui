/**
 * Copy the first `seconds` of a buffer into a new, smaller one.
 *
 * Used to keep a short preview slice alive while releasing the full decode: a
 * 4-minute stereo track is ~84MB of Float32, a 10-second slice is ~3.5MB. That
 * lets the user drag the BPM slider and re-hear the result instantly without
 * either re-decoding the file or pinning the whole track in memory.
 */
export function sliceSeconds(buffer: AudioBuffer, seconds: number): AudioBuffer {
  const frames = Math.min(buffer.length, Math.ceil(seconds * buffer.sampleRate));
  const slice = new AudioBuffer({
    length: frames,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  });

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    slice.copyToChannel(buffer.getChannelData(channel).subarray(0, frames), channel);
  }
  return slice;
}
