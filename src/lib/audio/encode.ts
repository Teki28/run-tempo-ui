import { MP3_BITRATE_KBPS, SAMPLE_RATE } from './constants';
import type { Mp3Stream } from './mp3-core';
import type { WorkerRequest, WorkerResponse } from './mp3-worker';
import { floatToInt16 } from './pcm';

export type ProgressFn = (fraction: number) => void;

/** Omit over a union has to distribute, or it collapses to the common keys. */
type Unidentified<T> = T extends unknown ? Omit<T, 'id'> : never;

interface Pending {
  settle: (data?: Uint8Array) => void;
  fail: (error: Error) => void;
  onProgress?: ProgressFn;
  totalSamples: number;
}

/**
 * An MP3 encoding session, running in a Web Worker where possible.
 *
 * Push one rendered track and finish for a single download; push several before
 * finishing to concatenate them into one file. Encoding a 4-minute track takes a
 * few seconds, which is why it does not belong on the main thread.
 */
export class Mp3Session {
  private worker: Worker | null = null;
  private stream: Mp3Stream | null = null;
  private pending = new Map<number, Pending>();
  private seq = 0;

  private constructor(private readonly channels: number) {}

  static async create(channels: number): Promise<Mp3Session> {
    const session = new Mp3Session(channels);
    try {
      await session.startWorker(channels);
    } catch {
      // Module workers can be unavailable (older browsers, strict CSP). Fall
      // back to the main thread: it blocks for a few seconds, which beats a
      // download that never arrives.
      session.teardownWorker();
      const { createStream } = await import('./mp3-core');
      session.stream = createStream(channels, SAMPLE_RATE, MP3_BITRATE_KBPS);
    }
    return session;
  }

  private async startWorker(channels: number): Promise<void> {
    const worker = new Worker(new URL('./mp3-worker.ts', import.meta.url), { type: 'module' });
    this.worker = worker;
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.receive(event.data);
    // A module worker that fails to load reports asynchronously, so the pending
    // 'begin' below is what actually surfaces the failure to create().
    worker.onerror = (event) =>
      this.rejectAll(new Error(event.message || 'MP3 worker failed to start'));

    await this.request({
      type: 'begin',
      channels,
      sampleRate: SAMPLE_RATE,
      kbps: MP3_BITRATE_KBPS,
    });
  }

  private teardownWorker(): void {
    if (!this.worker) return;
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.terminate();
    this.worker = null;
    this.pending.clear();
  }

  /** Encode one rendered buffer into the session. */
  async push(buffer: AudioBuffer, onProgress?: ProgressFn): Promise<void> {
    const left = floatToInt16(buffer.getChannelData(0));
    const right =
      this.channels === 2 && buffer.numberOfChannels > 1
        ? floatToInt16(buffer.getChannelData(1))
        : null;

    if (this.stream) {
      this.stream.encode(left, right, (done) => onProgress?.(done / left.length));
      return;
    }

    const total = left.length;
    const transfer = right ? [left.buffer, right.buffer] : [left.buffer];
    await this.request({ type: 'push', left, right }, transfer, onProgress, total);
  }

  /** Flush and return the finished MP3. The session is spent afterwards. */
  async finish(): Promise<Uint8Array> {
    if (this.stream) {
      const data = this.stream.finish();
      this.stream = null;
      return data;
    }
    const data = await this.request({ type: 'finish' });
    this.teardownWorker();
    return data ?? new Uint8Array();
  }

  dispose(): void {
    this.teardownWorker();
    this.stream = null;
  }

  private request(
    body: Unidentified<WorkerRequest>,
    transfer: Transferable[] = [],
    onProgress?: ProgressFn,
    totalSamples = 0,
  ): Promise<Uint8Array | undefined> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error('MP3 worker is not running'));

    const id = ++this.seq;
    return new Promise<Uint8Array | undefined>((resolve, reject) => {
      this.pending.set(id, { settle: resolve, fail: reject, onProgress, totalSamples });
      worker.postMessage({ ...body, id } as WorkerRequest, transfer);
    });
  }

  private receive(message: WorkerResponse): void {
    const entry = this.pending.get(message.id);
    if (!entry) return;

    switch (message.type) {
      case 'progress':
        if (entry.totalSamples > 0) entry.onProgress?.(message.samplesDone / entry.totalSamples);
        return;
      case 'ok':
        this.pending.delete(message.id);
        entry.onProgress?.(1);
        entry.settle();
        return;
      case 'done':
        this.pending.delete(message.id);
        entry.settle(message.data);
        return;
      case 'error':
        this.pending.delete(message.id);
        entry.fail(new Error(message.message));
        return;
    }
  }

  private rejectAll(error: Error): void {
    for (const [, entry] of this.pending) entry.fail(error);
    this.pending.clear();
  }
}

/** Convenience wrapper for the common single-track case. */
export async function encodeToMp3(buffer: AudioBuffer, onProgress?: ProgressFn): Promise<Uint8Array> {
  const channels = buffer.numberOfChannels >= 2 ? 2 : 1;
  const session = await Mp3Session.create(channels);
  try {
    await session.push(buffer, onProgress);
    return await session.finish();
  } finally {
    session.dispose();
  }
}
