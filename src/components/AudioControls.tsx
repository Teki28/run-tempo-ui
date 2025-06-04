'use client';

import React, { useState, useRef } from 'react';
import BpmControls from './BpmControls';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface AudioControlsProps {
  fileId: string;
}

export default function AudioControls({ fileId }: AudioControlsProps) {
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isPlayingProcessed, setIsPlayingProcessed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bpm, setBpm] = useState(120);
  const [volume, setVolume] = useState(100);  // Default to 100% (normal volume)
  
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const processedAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentBlobUrl = useRef<string | null>(null);

  const handlePreviewPlay = () => {
    if (!previewAudioRef.current) return;

    if (isPlayingPreview) {
      previewAudioRef.current.pause();
    } else {
      previewAudioRef.current.play();
    }
  };

  const processAndPlayAudio = async () => {
    if (!processedAudioRef.current) return;
    
    try {
      setIsLoading(true);
      setError(null);

      // Clean up previous blob URL if it exists
      if (currentBlobUrl.current) {
        URL.revokeObjectURL(currentBlobUrl.current);
        currentBlobUrl.current = null;
      }

      // Get processed audio from backend
      const response = await fetch(
        `${API_URL}/preview/process?preview_id=${fileId}&bpm=${bpm}&volume=${volume}`,
        { method: 'POST' }
      );
      
      if (!response.ok) {
        throw new Error('Failed to process audio');
      }

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Received empty audio data');
      }

      // Create new blob URL
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      currentBlobUrl.current = url;

      // Load and play the audio
      processedAudioRef.current.src = url;
      processedAudioRef.current.load();
      
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error('Audio load timeout'));
        }, 5000);

        const handleCanPlay = () => {
          cleanup();
          resolve(undefined);
        };

        const handleError = () => {
          cleanup();
          reject(new Error('Failed to load audio'));
        };

        const cleanup = () => {
          clearTimeout(timeoutId);
          processedAudioRef.current?.removeEventListener('canplaythrough', handleCanPlay);
          processedAudioRef.current?.removeEventListener('error', handleError);
        };

        processedAudioRef.current?.addEventListener('canplaythrough', handleCanPlay);
        processedAudioRef.current?.addEventListener('error', handleError);
      });

      await processedAudioRef.current.play();
      setIsPlayingProcessed(true);
    } catch (err) {
      console.error('Error playing processed audio:', err);
      setError(err instanceof Error ? err.message : 'Failed to play audio');
      setIsPlayingProcessed(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessedPlay = () => {
    if (!processedAudioRef.current) return;

    if (isPlayingProcessed) {
      processedAudioRef.current.pause();
      setIsPlayingProcessed(false);
    } else {
      processAndPlayAudio();
    }
  };

  // Clean up blob URL when component unmounts
  React.useEffect(() => {
    return () => {
      if (currentBlobUrl.current) {
        URL.revokeObjectURL(currentBlobUrl.current);
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-xs text-gray-500 mb-2">
        Tip: You can amplify the metronome volume up to 500% if needed
      </div>
      <BpmControls
        onBpmChange={setBpm}
        onVolumeChange={setVolume}
        defaultBpm={bpm}
        defaultVolume={volume}
      />

      <div className="flex gap-4">
        <button
          onClick={handlePreviewPlay}
          className="flex items-center justify-center px-4 py-2 rounded-full text-white font-medium bg-blue-500 hover:bg-blue-600 transition-colors"
        >
          <span className="flex items-center">
            {isPlayingPreview ? (
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
        </button>

        <button
          onClick={handleProcessedPlay}
          disabled={isLoading}
          className={`flex items-center justify-center px-4 py-2 rounded-full text-white font-medium transition-colors
            ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'}
          `}
        >
          {isLoading ? (
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
                  Pause Processed
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  Play with BPM
                </>
              )}
            </span>
          )}
        </button>
      </div>

      <audio
        ref={previewAudioRef}
        src={`${API_URL}/stream/preview/${fileId}`}
        onPlay={() => setIsPlayingPreview(true)}
        onPause={() => setIsPlayingPreview(false)}
        onEnded={() => setIsPlayingPreview(false)}
      />

      <audio
        ref={processedAudioRef}
        onPlay={() => setIsPlayingProcessed(true)}
        onPause={() => setIsPlayingProcessed(false)}
        onEnded={() => setIsPlayingProcessed(false)}
      />

      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
} 