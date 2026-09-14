'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAudioEngine, type PreparedTracks } from '@/hooks/useAudioEngine';
import { ACCEPTED_AUDIO, MAX_FILES } from '@/lib/audio';
import AudioControls from './AudioControls';
import content from '../content.json';

type ValidLang = 'en' | 'zh' | 'ja';

interface AudioUploaderProps {
  lang: ValidLang;
  onReady?: (tracks: PreparedTracks) => void;
  onError?: (error: string) => void;
}

export default function AudioUploader({ lang, onReady, onError }: AudioUploaderProps) {
  const [tracks, setTracks] = useState<PreparedTracks | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);

  const { prepareFiles, prepareSample, describe } = useAudioEngine();

  const accept = useCallback(
    async (load: () => Promise<PreparedTracks>) => {
      setError(null);
      setIsPreparing(true);
      try {
        const prepared = await load();
        setTracks(prepared);
        setGeneration((n) => n + 1);
        onReady?.(prepared);
      } catch (err) {
        const message = describe(err);
        setError(message);
        setTracks(null);
        onError?.(message);
      } finally {
        setIsPreparing(false);
      }
    },
    [describe, onReady, onError],
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length === 0) return;
      void accept(() => prepareFiles(accepted));
    },
    [accept, prepareFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_AUDIO,
    maxFiles: MAX_FILES,
    disabled: isPreparing,
  });

  const copy = content[lang].main.audioUploader;

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        {...getRootProps()}
        className={`p-8 border-2 border-dashed rounded-lg transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${isPreparing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-blue-500'}
        `}
      >
        <input {...getInputProps()} />
        <div className="text-center">
          {isPreparing ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">{copy.uploading}</div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div className="bg-blue-600 h-2.5 rounded-full w-1/3 animate-pulse" />
              </div>
            </div>
          ) : (
            <div>
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-4">
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-4-4V7a4 4 0 014-4h10a4 4 0 014 4v5a4 4 0 01-4 4H7z"
                  />
                </svg>
              </div>
              <p className="text-sm text-gray-600">
                {isDragActive ? copy.dragAndDropActive : copy.dragAndDropInactive}
              </p>
              <p className="text-xs text-gray-500 mt-2">{copy.dragAndDropSize}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <button
          onClick={() => void accept(prepareSample)}
          disabled={isPreparing}
          className={`px-4 py-2 text-sm font-medium text-white rounded-full transition-colors
            ${isPreparing ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-500 hover:bg-purple-600'}
          `}
        >
          {isPreparing ? copy.loading : copy.TrySampleMusic}
        </button>
      </div>

      {tracks && (
        <div className="mt-4 space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg space-y-2 border border-gray-200">
            <div className="text-green-700 font-medium">{copy.uploadSuccess}</div>
            <ul className="text-sm space-y-1">
              {tracks.files.map((file) => (
                <li
                  key={`${file.name}-${file.size}`}
                  className="p-2 bg-white rounded border border-gray-200 font-mono text-xs text-gray-700 truncate"
                >
                  {file.name}
                </li>
              ))}
            </ul>
          </div>
          <AudioControls
            key={generation}
            lang={lang}
            files={tracks.files}
            preview={tracks.preview}
          />
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}
    </div>
  );
}
