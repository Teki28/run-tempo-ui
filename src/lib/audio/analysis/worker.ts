/// <reference lib="webworker" />
import { stretchChannels } from '../stretch/core';
import { detectBeats, type AnalysisStage, type BeatAnalysis } from './detect';

export type WorkerRequest =
  | { id: number; type: 'analyse'; mono: Float32Array; sampleRate: number }
  | { id: number; type: 'stretch'; channels: Float32Array[]; factor: number };

export type WorkerResponse =
  | { id: number; type: 'stage'; stage: AnalysisStage; fraction: number }
  | { id: number; type: 'progress'; fraction: number }
  | { id: number; type: 'analysed'; analysis: BeatAnalysis | null }
  | { id: number; type: 'stretched'; channels: Float32Array[] }
  | { id: number; type: 'error'; message: string };

const post = (message: WorkerResponse, transfer: Transferable[] = []) =>
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(message, transfer);

/** Progress is throttled: a message per envelope frame would flood the port. */
const THROTTLE_MS = 100;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    switch (request.type) {
      case 'analyse': {
        let last = 0;
        const analysis = detectBeats(request.mono, {
          sampleRate: request.sampleRate,
          onProgress: (stage, fraction) => {
            const now = Date.now();
            if (fraction >= 1 || now - last >= THROTTLE_MS) {
              last = now;
              post({ id: request.id, type: 'stage', stage, fraction });
            }
          },
        });
        post({ id: request.id, type: 'analysed', analysis });
        break;
      }

      case 'stretch': {
        let last = 0;
        const channels = stretchChannels({
          channels: request.channels,
          factor: request.factor,
          onProgress: (fraction) => {
            const now = Date.now();
            if (fraction >= 1 || now - last >= THROTTLE_MS) {
              last = now;
              post({ id: request.id, type: 'progress', fraction });
            }
          },
        });
        post(
          { id: request.id, type: 'stretched', channels },
          channels.map((c) => c.buffer),
        );
        break;
      }
    }
  } catch (error) {
    post({
      id: request.id,
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
