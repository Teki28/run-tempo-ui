import type { BeatAnalysis } from './detect';

const DB_NAME = 'run-tempo-analysis';
const STORE = 'beats';
const DB_VERSION = 1;

/**
 * Bumped whenever the detector changes in a way that would give a different
 * answer. Entries from an older detector are ignored rather than migrated —
 * re-analysing costs a few hundred milliseconds, and serving a stale beat grid
 * would be a silent, hard-to-explain regression.
 */
const ANALYSIS_VERSION = 1;

interface CacheRecord {
  key: string;
  version: number;
  storedAt: number;
  bpm: number;
  /** Stored as a typed array; IndexedDB clones these natively. */
  beats: Float32Array;
  confidence: number;
  beatStrength: number;
  subdivisionStrength: number;
  drift: number;
}

/**
 * Identify a file by its content.
 *
 * Name and size are not enough — two different edits of a track can share
 * both, and re-encoding a file keeps the name while changing every beat. The
 * hash covers the bytes the user actually picked.
 *
 * Hashing 50MB costs roughly as much as a decode, so only the head, tail and
 * size go in: enough that no realistic pair of audio files collides, and cheap
 * enough to run on every upload.
 */
export async function fileKey(file: File): Promise<string> {
  const SAMPLE = 1 << 20;
  const head = await file.slice(0, SAMPLE).arrayBuffer();
  const tail = await file.slice(Math.max(0, file.size - SAMPLE)).arrayBuffer();

  const payload = new Uint8Array(head.byteLength + tail.byteLength + 8);
  payload.set(new Uint8Array(head), 0);
  payload.set(new Uint8Array(tail), head.byteLength);
  new DataView(payload.buffer).setFloat64(head.byteLength + tail.byteLength, file.size);

  const digest = await crypto.subtle.digest('SHA-256', payload);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

/**
 * Every cache operation is best-effort.
 *
 * IndexedDB is unavailable in private browsing on some versions of Safari, can
 * be disabled outright, and throws on quota exhaustion. None of that should
 * stop a user from processing a song, so failures degrade to a cache miss.
 */
async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  if (typeof indexedDB === 'undefined') return null;
  let db: IDBDatabase | null = null;
  try {
    db = await open();
    return await new Promise<T | null>((resolve, reject) => {
      const transaction = db!.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

export async function readAnalysis(key: string): Promise<BeatAnalysis | null> {
  const record = await withStore<CacheRecord | undefined>('readonly', (store) => store.get(key));
  if (!record || record.version !== ANALYSIS_VERSION) return null;
  return {
    bpm: record.bpm,
    beats: Array.from(record.beats),
    confidence: record.confidence,
    beatStrength: record.beatStrength,
    subdivisionStrength: record.subdivisionStrength,
    drift: record.drift,
  };
}

export async function writeAnalysis(key: string, analysis: BeatAnalysis): Promise<void> {
  const record: CacheRecord = {
    key,
    version: ANALYSIS_VERSION,
    storedAt: Date.now(),
    bpm: analysis.bpm,
    beats: Float32Array.from(analysis.beats),
    confidence: analysis.confidence,
    beatStrength: analysis.beatStrength,
    subdivisionStrength: analysis.subdivisionStrength,
    drift: analysis.drift,
  };
  await withStore('readwrite', (store) => store.put(record));
}
