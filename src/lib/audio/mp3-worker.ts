/// <reference lib="webworker" />
import { createStream, type Mp3Stream } from './mp3-core';

export type WorkerRequest =
  | { id: number; type: 'begin'; channels: number; sampleRate: number; kbps: number }
  | { id: number; type: 'push'; left: Int16Array; right: Int16Array | null }
  | { id: number; type: 'finish' };

export type WorkerResponse =
  | { id: number; type: 'ok' }
  | { id: number; type: 'progress'; samplesDone: number }
  | { id: number; type: 'done'; data: Uint8Array }
  | { id: number; type: 'error'; message: string };

let stream: Mp3Stream | null = null;

const post = (message: WorkerResponse, transfer?: Transferable[]) =>
  (self as DedicatedWorkerGlobalScope).postMessage(message, transfer ?? []);

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    switch (request.type) {
      case 'begin':
        stream = createStream(request.channels, request.sampleRate, request.kbps);
        post({ id: request.id, type: 'ok' });
        break;

      case 'push': {
        if (!stream) throw new Error('Encoder session was never started');
        stream.encode(request.left, request.right, (samplesDone) =>
          post({ id: request.id, type: 'progress', samplesDone }),
        );
        post({ id: request.id, type: 'ok' });
        break;
      }

      case 'finish': {
        if (!stream) throw new Error('Encoder session was never started');
        const data = stream.finish();
        stream = null;
        post({ id: request.id, type: 'done', data }, [data.buffer]);
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
