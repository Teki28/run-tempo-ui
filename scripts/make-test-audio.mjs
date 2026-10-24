/**
 * Generate test tracks with known, exact beat positions.
 *
 * Purpose-built rather than borrowed music: the point of these files is that
 * the ground truth is known to the sample, so when a click sounds early you
 * know it is the app and not the material. Each case targets one behaviour the
 * beat-sync path has to get right, and `late-start` in particular is the bug
 * the whole feature exists to fix — a song whose first beat is not at t=0.
 *
 * Usage: node scripts/make-test-audio.mjs [outDir]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SR = 44100;
const OUT = process.argv[2] ?? 'test-audio';

/** xorshift32, so runs are reproducible and the noise is actually white. */
let seed = 2463534242;
const rnd = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 4294967296 - 0.5;
};

const makeBuffer = (seconds) => ({
  left: new Float32Array(Math.round(seconds * SR)),
  right: new Float32Array(Math.round(seconds * SR)),
  seconds,
});

function add(buf, at, i, value) {
  const idx = Math.round(at * SR) + i;
  if (idx < 0 || idx >= buf.left.length) return false;
  buf.left[idx] += value;
  buf.right[idx] += value;
  return true;
}

/**
 * Kick: a sine whose pitch falls from 110Hz to 45Hz, plus a hard transient.
 * The transient is what makes the beat position unambiguous to the ear — a
 * pure low sine has a vague attack, and "is the click early?" becomes a matter
 * of opinion.
 */
function kick(buf, at, level = 1) {
  const length = Math.round(SR * 0.3);
  let phase = 0;
  for (let i = 0; i < length; i++) {
    const t = i / SR;
    const freq = 45 + 65 * Math.exp(-t / 0.028);
    phase += (2 * Math.PI * freq) / SR;
    const body = Math.sin(phase) * Math.exp(-t / 0.085);
    const transient = i < SR * 0.004 ? rnd() * 1.6 * (1 - i / (SR * 0.004)) : 0;
    if (!add(buf, at, i, level * (body * 0.95 + transient * 0.5))) break;
  }
}

/** Snare: noise plus a 190Hz ring, the classic backbeat marker. */
function snare(buf, at, level = 1) {
  const length = Math.round(SR * 0.22);
  for (let i = 0; i < length; i++) {
    const t = i / SR;
    const noise = rnd() * 2 * Math.exp(-t / 0.055);
    const ring = Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t / 0.035) * 0.5;
    if (!add(buf, at, i, level * (noise * 0.55 + ring))) break;
  }
}

/**
 * Closed hi-hat: differentiated noise, which is a cheap high-pass. Kept quiet
 * on purpose — loud offbeat hats are a standard cause of a doubled tempo
 * reading, and these files should test alignment, not fight the detector.
 */
function hat(buf, at, level = 0.3) {
  const length = Math.round(SR * 0.05);
  let previous = 0;
  for (let i = 0; i < length; i++) {
    const t = i / SR;
    const sample = rnd();
    const high = sample - previous;
    previous = sample;
    if (!add(buf, at, i, level * high * 1.5 * Math.exp(-t / 0.012))) break;
  }
}

/** Bass note, so the result is listenable rather than a drum machine alone. */
function bass(buf, at, hz, duration, level = 0.4) {
  const length = Math.round(SR * duration);
  for (let i = 0; i < length; i++) {
    const t = i / SR;
    // Two detuned saws, lightly rounded.
    const saw = (x) => 2 * (x - Math.floor(x + 0.5));
    const tone = saw(hz * t) * 0.6 + saw(hz * 1.005 * t) * 0.4;
    const env = Math.min(1, t / 0.006) * Math.exp(-t / (duration * 0.55));
    if (!add(buf, at, i, level * tone * env * 0.5)) break;
  }
}

/** Normalise to a fixed peak, leaving headroom so nothing clips on mixdown. */
function normalise(buf, peak = 0.89) {
  let max = 0;
  for (let i = 0; i < buf.left.length; i++) max = Math.max(max, Math.abs(buf.left[i]));
  if (max === 0) return;
  const gain = peak / max;
  for (let i = 0; i < buf.left.length; i++) {
    buf.left[i] *= gain;
    buf.right[i] *= gain;
  }
}

/** 16-bit stereo PCM WAV. Clamped, for the same reason floatToInt16 clamps. */
function toWav(buf) {
  const frames = buf.left.length;
  const dataBytes = frames * 4;
  const out = Buffer.alloc(44 + dataBytes);

  out.write('RIFF', 0);
  out.writeUInt32LE(36 + dataBytes, 4);
  out.write('WAVE', 8);
  out.write('fmt ', 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20); // PCM
  out.writeUInt16LE(2, 22); // stereo
  out.writeUInt32LE(SR, 24);
  out.writeUInt32LE(SR * 4, 28); // byte rate
  out.writeUInt16LE(4, 32); // block align
  out.writeUInt16LE(16, 34);
  out.write('data', 36);
  out.writeUInt32LE(dataBytes, 40);

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (const channel of [buf.left, buf.right]) {
      const s = Math.max(-1, Math.min(1, channel[i]));
      out.writeInt16LE(Math.round(s < 0 ? s * 32768 : s * 32767), offset);
      offset += 2;
    }
  }
  return out;
}

const ROOTS = [55, 55, 73.42, 65.41]; // A1 A1 D2 C2, one per bar

/**
 * Lay down a straight 4/4 pattern and return the exact beat times.
 *
 * `tempoAt` takes the elapsed time and returns the instantaneous BPM, which is
 * what lets one function produce both the steady and the accelerating cases.
 */
function pattern(buf, { tempoAt, leadIn = 0, halfTime = false, hats = true }) {
  const beats = [];
  let t = leadIn;
  let beat = 0;

  while (t < buf.seconds) {
    const inBar = beat % 4;
    const period = 60 / tempoAt(t);
    beats.push(t);

    if (halfTime) {
      // Kick on 1 and 3, snare on 2 and 4: a slow, heavy feel where the
      // half-beat subdivision the app will click on is clearly audible.
      if (inBar === 0 || inBar === 2) kick(buf, t, inBar === 0 ? 1 : 0.85);
      if (inBar === 1 || inBar === 3) snare(buf, t, 0.8);
    } else {
      kick(buf, t, inBar === 0 ? 1 : 0.8);
      if (inBar === 1 || inBar === 3) snare(buf, t, 0.85);
    }

    if (hats) {
      hat(buf, t + period / 2, 0.26);
      if (!halfTime) hat(buf, t, 0.16);
    }

    if (inBar === 0) bass(buf, t, ROOTS[(beat / 4) % ROOTS.length | 0], period * 3.6);

    t += period;
    beat++;
  }
  return beats;
}

const steady = (bpm) => () => bpm;
const ramp = (from, to, seconds) => (t) => from + ((to - from) * t) / seconds;

const CASES = [
  {
    name: 'steady-128',
    seconds: 48,
    note: 'Four-on-the-floor house. Detects 128; needs x1.5 (192) and runs out of stretch, so it should offer the snap.',
    build: (buf) => pattern(buf, { tempoAt: steady(128) }),
  },
  {
    name: 'slow-85',
    seconds: 48,
    note: 'Half-time, 85 BPM. The spec example: x2 reaches 170 exactly with NO stretching.',
    build: (buf) => pattern(buf, { tempoAt: steady(85), halfTime: true }),
  },
  {
    name: 'fast-174',
    seconds: 48,
    note: 'Fast rock/DnB at 174. Where other trackers report exactly 87; x1 plus a small stretch should give 170.',
    build: (buf) => pattern(buf, { tempoAt: steady(174), hats: false }),
  },
  {
    name: 'drift-124-to-136',
    seconds: 60,
    note: 'Accelerates steadily. The click period must shorten with the music; a fixed grid ends ~half a beat out.',
    build: (buf) => pattern(buf, { tempoAt: ramp(124, 136, 60) }),
  },
  {
    name: 'late-start-120',
    seconds: 48,
    note: 'THE regression case: 1.37s of silence first, so the old fixed grid is 1.37s out of phase on every single beat.',
    build: (buf) => pattern(buf, { tempoAt: steady(120), leadIn: 1.37 }),
  },
];

mkdirSync(OUT, { recursive: true });
const manifest = [];

for (const testCase of CASES) {
  seed = 2463534242; // reset so each file is reproducible
  const buf = makeBuffer(testCase.seconds);
  const beats = testCase.build(buf);
  normalise(buf);

  const wav = toWav(buf);
  const file = join(OUT, `${testCase.name}.wav`);
  writeFileSync(file, wav);

  // The beat times go alongside, so a failure can be checked against truth.
  writeFileSync(
    join(OUT, `${testCase.name}.beats.json`),
    JSON.stringify({ name: testCase.name, note: testCase.note, beats }, null, 1),
  );

  manifest.push({ file, beats: beats.length, mb: (wav.length / 1048576).toFixed(1), note: testCase.note });
  console.log(
    `${testCase.name.padEnd(18)} ${String(testCase.seconds).padStart(2)}s  ` +
      `${String(beats.length).padStart(3)} beats  ${(wav.length / 1048576).toFixed(1)}MB`,
  );
}

writeFileSync(join(OUT, 'README.txt'),
  manifest.map((m) => `${m.file}\n  ${m.note}\n`).join('\n'));
console.log(`\nWrote ${CASES.length} files to ${OUT}/ (plus .beats.json ground truth)`);
