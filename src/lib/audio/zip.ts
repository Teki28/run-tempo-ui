import { zipSync } from 'fflate';

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/**
 * Bundle encoded tracks into a zip.
 *
 * Stored, not deflated: MP3 is already compressed, so level 0 produces a file
 * of the same size without spending seconds on it.
 */
export function zipFiles(entries: ZipEntry[]): Uint8Array {
  const payload: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const entry of entries) {
    payload[entry.name] = [entry.data, { level: 0 }];
  }
  return zipSync(payload, { level: 0 });
}
