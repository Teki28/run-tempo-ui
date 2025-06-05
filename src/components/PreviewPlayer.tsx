'use client';

import React, { useState, useRef, useEffect } from 'react';
import BpmControls from './BpmControls';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface PreviewPlayerProps {
  previewId: string;
}

export default function PreviewPlayer({ previewId }: PreviewPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bpm, setBpm] = useState(120);
  const [volume, setVolume] = useState(100);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const processPreview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_URL}/process/preview?preview_id=${previewId}&bpm=${bpm}&volume=${volume}`,
        { method: 'POST' }
      );
      
      if (!response.ok) {
        throw new Error('Failed to process preview');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      
      // Clean up old URL if it exists
      if (audioRef.current?.src) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      
      return url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlay = async () => {
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        // If we don't have an audio URL yet or BPM/volume changed, process the preview
        if (!audioUrl) {
          const newUrl = await processPreview();
          if (!newUrl) return;
        }
        await audioRef.current.play();
      }
    } catch (err) {
      setError('Error playing audio');
      console.error('Audio playback error:', err);
    }
  };

  // Clean up object URL when component unmounts or when audioUrl changes
  useEffect(() => {
    return () => {
      if (audioUrl) {
        const urlToRevoke = audioUrl;
        URL.revokeObjectURL(urlToRevoke);
      }
    };
  }, [audioUrl]);

  // Reset audio URL when BPM or volume changes
  useEffect(() => {
    const currentUrl = audioUrl;
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      setAudioUrl(null);
    }
  }, [bpm, volume, audioUrl]);

  return (
    <div className="mt-4 space-y-4">
      <BpmControls
        onBpmChange={setBpm}
        onVolumeChange={setVolume}
        defaultBpm={bpm}
        defaultVolume={volume}
      />

      <button
        onClick={togglePlay}
        disabled={isLoading}
        className={`flex items-center justify-center px-4 py-2 rounded-full text-white font-medium transition-colors
          ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}
        `}
      >
        {isLoading ? (
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <span className="flex items-center">
            {isPlaying ? (
              <>
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Pause Preview
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                Play Preview
              </>
            )}
          </span>
        )}
      </button>

      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        onPlay={() => {
          setIsPlaying(true);
          setIsLoading(false);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onLoadedData={() => setIsLoading(false)}
        onError={() => {
          setError('Error loading audio');
          setIsLoading(false);
        }}
        preload="auto"
      />

      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
} 