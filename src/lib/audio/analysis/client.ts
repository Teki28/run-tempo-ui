import { SAMPLE_RATE } from '../constants';
import { detectBeats, type AnalysisStage, type BeatAnalysis } from './detect';
import type { WorkerRequest, WorkerResponse } from './worker';

export type StageFn = (stage: AnalysisStage | 'stretching', fraction: number) => void;

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  onStage?: StageFn;
}

/** Omit over a union has to distribute, or it collapses to the common keys. */
type Unidentified<T> = T extends unknown ? Omit<T, 'id'> : never;

/**
 * Runs beat detection and time-stretching in a Worker.
 *
 * Both jobs are hundreds of milliseconds of straight-line number crunching on
 * a multi-minute track — on the main thread they would freeze the UI outright,
 * including the progress bar meant to show they are happening.
 *
 * Falls back to the main thread when a module Worker cannot start (older
 * browsers, strict CSP), on the same reasoning as the MP3 encoder: a janky few
 * hundred milliseconds beats a feature that silently does nothing.
 */
export class AnalysisEngine {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private seq = 0;
  private startFailed = false;

  private ensureWorker(): Worker | null {
    if (this.worker || this.startFailed) return this.worker;
    try {
      const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.receive(event.data);
      worker.onerror = () => {
        // A module worker that fails to load reports asynchronously, so the
        // in-flight request is what surfaces the failure to the caller.
        this.startFailed = true;
        this.rejectAll(new Error('Analysis worker failed to start'));
      };
      this.worker = worker;
    } catch {
      this.startFailed = true;
    }
    return this.worker;
  }

  /** Detect tempo and beat positions for a mono signal. */
  async analyse(
    mono: Float32Array,
    sampleRate: number = SAMPLE_RATE,
    onStage?: StageFn,
  ): Promise<BeatAnalysis | null> {
    const worker = this.ensureWorker();
    if (!worker) return detectBeats(mono, { sampleRate, onProgress: onStage });

    try {
      // Transferred, not copied: a four-minute mono track is ~42MB, and
      // structured-cloning that would double peak memory on a phone.
      return await this.request<BeatAnalysis | null>(
        { type: 'analyse', mono, sampleRate },
        [mono.buffer],
        onStage,
      );
    } catch {
      return null;
    }
  }

  /** Time-stretch channel data by an output-duration multiplier. */
  async stretch(
    channels: Float32Array[],
    factor: number,
    onStage?: StageFn,
  ): Promise<Float32Array[]> {
    const worker = this.ensureWorker();
    if (!worker) {
      const { stretchChannels } = await import('../stretch/core');
      return stretchChannels({
        channels,
        factor,
        onProgress: (f) => onStage?.('stretching', f),
      });
    }
    return this.request<Float32Array[]>(
      { type: 'stretch', channels, factor },
      channels.map((c) => c.buffer),
      onStage,
    );
  }

  dispose(): void {
    if (!this.worker) return;
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.terminate();
    this.worker = null;
    this.pending.clear();
  }

  private request<T>(
    body: Unidentified<WorkerRequest>,
    transfer: Transferable[],
    onStage?: StageFn,
  ): Promise<T> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error('Analysis worker is not running'));

    const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        onStage,
      });
      worker.postMessage({ ...body, id } as WorkerRequest, transfer);
    });
  }

  private receive(message: WorkerResponse): void {
    const entry = this.pending.get(message.id);
    if (!entry) return;

    switch (message.type) {
      case 'stage':
        entry.onStage?.(message.stage, message.fraction);
        return;
      case 'progress':
        entry.onStage?.('stretching', message.fraction);
        return;
      case 'analysed':
        this.pending.delete(message.id);
        entry.resolve(message.analysis);
        return;
      case 'stretched':
        this.pending.delete(message.id);
        entry.resolve(message.channels);
        return;
      case 'error':
        this.pending.delete(message.id);
        entry.reject(new Error(message.message));
        return;
    }
  }

  private rejectAll(error: Error): void {
    for (const [, entry] of this.pending) entry.reject(error);
    this.pending.clear();
  }
}
