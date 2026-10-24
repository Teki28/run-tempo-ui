/**
 * Collapse an AudioBuffer to one mono Float32Array for analysis.
 *
 * Analysis gets mono but keeps the full sample rate. Mono halves the working
 * set for nothing — beat tracking has no use for the stereo image — whereas
 * decimating would be the larger saving and is not available to us: the onset
 * filterbanks in these trackers are tuned for 44.1kHz and report a
 * proportionally wrong tempo on a resampled signal.
 *
 * The returned array is a fresh allocation, so the caller can drop the decoded
 * AudioBuffer immediately afterwards and hand this to a worker by transfer.
 */
export function toMono(buffer: AudioBuffer): Float32Array {
  const frames = buffer.length;
  const channels = buffer.numberOfChannels;

  if (channels === 1) {
    // Still a copy: the caller releases the AudioBuffer right after this, and
    // getChannelData hands back a view onto memory that goes with it.
    const mono = new Float32Array(frames);
    mono.set(buffer.getChannelData(0));
    return mono;
  }

  const mono = new Float32Array(frames);
  for (let channel = 0; channel < channels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < frames; i++) mono[i] += data[i];
  }
  const scale = 1 / channels;
  for (let i = 0; i < frames; i++) mono[i] *= scale;
  return mono;
}
