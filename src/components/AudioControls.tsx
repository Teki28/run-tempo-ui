'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import BpmControls from './BpmControls';
import content from '../content.json';

type ValidLang = 'en' | 'zh' | 'ja';

interface AudioControlsProps {
  lang: ValidLang;
  /** Full-length sources, decoded lazily one at a time when downloading. */
  files: File[];
  /** Pre-sliced 10s buffer used for auditioning. */
  preview: AudioBuffer;
}

interface PreviewCache {
  bpm: number;
  volume: number;
  url: string;
}

export default function AudioControls({ lang, files, preview: previewBuffer }: AudioControlsProps) {
  const [isPlayingOriginal, setIsPlayingOriginal] = useState(false);
  const [isPlayingProcessed, setIsPlayingProcessed] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [bpm, setBpm] = useState(120);
  const [volume, setVolume] = useState(100);

  const originalAudioRef = useRef<HTMLAudioElement>(null);
  const processedAudioRef = useRef<HTMLAudioElement>(null);
  const cache = useRef<PreviewCache | null>(null);

  const { preview, download, progress, describe } = useAudioEngine();

  const dropCache = useCallback(() => {
    if (cache.current) URL.revokeObjectURL(cache.current.url);
    cache.current = null;
  }, []);

  /**
   * play() rejects with AbortError whenever playback is superseded before it
   * actually starts — pausing quickly, or loading a new clip. That race is
   * normal and invisible to the user, so surfacing it as a red error would be
   * noise. Anything else (a blocked autoplay, a decode failure) is worth showing.
   */
  const reportPlaybackError = useCallback(
    (err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(describe(err));
    },
    [describe],
  );

  // The unprocessed clip is just a render with the click silenced, so both
  // players are the same 10 seconds and A/B comparison is honest.
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;

    preview(previewBuffer, { bpm: 120, volume: 0 })
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setOriginalUrl(url);
      })
      .catch((err) => !cancelled && setError(describe(err)));

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [previewBuffer, preview, describe]);

  useEffect(() => dropCache, [dropCache]);

  const handleOriginalPlay = () => {
    const el = originalAudioRef.current;
    if (!el) return;
    if (isPlayingOriginal) el.pause();
    else el.play().catch(reportPlaybackError);
  };

  const playProcessed = async () => {
    const el = processedAudioRef.current;
    if (!el) return;

    try {
      if (cache.current?.bpm !== bpm || cache.current?.volume !== volume) {
        setIsRendering(true);
        setError(null);
        const blob = await preview(previewBuffer, { bpm, volume });
        dropCache();
        cache.current = { bpm, volume, url: URL.createObjectURL(blob) };
      }
    } catch (err) {
      setError(describe(err));
      return;
    } finally {
      // Cleared as soon as the audio exists, deliberately before playback is
      // attempted. play() stays pending indefinitely when the element never
      // reaches HAVE_FUTURE_DATA (a throttled or backgrounded tab), so awaiting
      // it here would leave the button disabled and spinning forever.
      setIsRendering(false);
    }

    el.src = cache.current!.url;
    el.load();
    el.play().catch((err) => {
      setIsPlayingProcessed(false);
      reportPlaybackError(err);
    });
  };

  const handleProcessedPlay = () => {
    if (isPlayingProcessed) processedAudioRef.current?.pause();
    else void playProcessed();
  };

  const handleDownload = async (merge: boolean) => {
    setIsDownloading(true);
    setError(null);
    try {
      const { blob, filename } = await download(files, { bpm, volume }, merge);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(describe(err));
    } finally {
      setIsDownloading(false);
    }
  };

  const copy = content[lang].main.audioControls;
  const percent = progress === null ? 0 : Math.round(progress * 100);

  return (
    <div className="space-y-6">
      <div className="text-xs text-gray-500 mb-2">{copy.tip}</div>
      <BpmControls
        lang={lang}
        onBpmChange={setBpm}
        onVolumeChange={setVolume}
        defaultBpm={bpm}
        defaultVolume={volume}
        disabled={isPlayingProcessed}
      />

      <div className="flex flex-wrap gap-4">
        <button
          onClick={handleOriginalPlay}
          disabled={!originalUrl}
          className="flex items-center justify-center px-4 py-2 rounded-full text-white font-medium bg-blue-500 hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          <span className="flex items-center">
            {isPlayingOriginal ? (
              <>
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {copy.pausePreview}
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                {copy.playPreview}
              </>
            )}
          </span>
        </button>

        <button
          onClick={handleProcessedPlay}
          disabled={isRendering}
          className={`flex items-center justify-center px-4 py-2 rounded-full text-white font-medium transition-colors
            ${isRendering ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'}
          `}
        >
          {isRendering ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <span className="flex items-center">
              {isPlayingProcessed ? (
                <>
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {copy.pauseProcessed}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  {copy.playProcessed}
                </>
              )}
            </span>
          )}
        </button>

        <button
          onClick={() => handleDownload(false)}
          disabled={isDownloading}
          className="flex items-center justify-center px-4 py-2 rounded-full text-white font-medium bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isDownloading
            ? copy.downloading
            : `${copy.download} (${files.length} file${files.length > 1 ? 's' : ''})`}
        </button>

        {files.length > 1 && (
          <button
            onClick={() => handleDownload(true)}
            disabled={isDownloading}
            className="flex items-center justify-center px-4 py-2 rounded-full text-white font-medium bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {isDownloading ? copy.Merging : copy.MergeToOneAndDownload}
          </button>
        )}
      </div>

      {isDownloading && progress !== null && (
        <div className="space-y-1">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="text-xs text-gray-600">
            {copy.processing} {percent}%
          </div>
        </div>
      )}

      <audio
        ref={originalAudioRef}
        src={originalUrl ?? undefined}
        onPlay={() => setIsPlayingOriginal(true)}
        onPause={() => setIsPlayingOriginal(false)}
        onEnded={() => setIsPlayingOriginal(false)}
      />

      <audio
        ref={processedAudioRef}
        onPlay={() => setIsPlayingProcessed(true)}
        onPause={() => setIsPlayingProcessed(false)}
        onEnded={() => setIsPlayingProcessed(false)}
      />

      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
    </div>
  );
}
