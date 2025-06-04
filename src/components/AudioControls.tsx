'use client';

import React, { useState, useRef, useEffect } from 'react';
import BpmControls from './BpmControls';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface AudioControlsProps {
  fileId: string;
}

interface ProcessedAudioCache {
  url: string;
  bpm: number;
  volume: number;
}

export default function AudioControls({ fileId }: AudioControlsProps) {
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isPlayingProcessed, setIsPlayingProcessed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bpm, setBpm] = useState(120);
  const [volume, setVolume] = useState(100);  // Default to 100% (normal volume)
  const [processedCache, setProcessedCache] = useState<ProcessedAudioCache | null>(null);
  
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const processedAudioRef = useRef<HTMLAudioElement | null>(null);

  const handlePreviewPlay = () => {
    if (!previewAudioRef.current) return;

    if (isPlayingPreview) {
      previewAudioRef.current.pause();
    } else {
      previewAudioRef.current.play();
    }
  };

  const processAudio = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${API_URL}/preview/process?preview_id=${fileId}&bpm=${bpm}&volume=${volume}`,
        { method: 'POST' }
      );
      
      if (!response.ok) {
        throw new Error('Failed to process audio');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      // Clean up old URL if it exists
      if (processedCache?.url) {
        URL.revokeObjectURL(processedCache.url);
      }
      
      // Cache the new processed audio
      setProcessedCache({
        url,
        bpm,
        volume
      });
      
      return url;
    } catch (err) {
      throw err;
    }
  };

  const handleProcessedPlay = async () => {
    if (!processedAudioRef.current) return;

    if (isPlayingProcessed) {
      processedAudioRef.current.pause();
    } else {
      try {
        // Check if we need to process the audio
        const needsProcessing = !processedCache || 
          processedCache.bpm !== bpm || 
          processedCache.volume !== volume;

        if (needsProcessing) {
          setIsLoading(true);
          const newUrl = await processAudio();
          
          // Set the new source
          processedAudioRef.current.src = newUrl;
          
          // Wait for the audio to be loaded before playing
          await new Promise((resolve) => {
            const handleCanPlay = () => {
              processedAudioRef.current?.removeEventListener('canplay', handleCanPlay);
              resolve(undefined);
            };
            processedAudioRef.current?.addEventListener('canplay', handleCanPlay);
          });
        }

        await processedAudioRef.current.play();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      // Clean up object URLs when component unmounts
      if (processedCache?.url) {
        URL.revokeObjectURL(processedCache.url);
      }
      
      // Stop any playing audio
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.currentTime = 0;
      }
      if (processedAudioRef.current) {
        processedAudioRef.current.pause();
        processedAudioRef.current.currentTime = 0;
      }
    };
  }, []);

  // Handle file ID changes
  useEffect(() => {
    // Reset playback state when file ID changes
    setIsPlayingPreview(false);
    setIsPlayingProcessed(false);
    setError(null);
    
    // Stop any playing audio
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    if (processedAudioRef.current) {
      processedAudioRef.current.pause();
      processedAudioRef.current.currentTime = 0;
    }
    
    // Clean up processed audio cache
    if (processedCache?.url) {
      URL.revokeObjectURL(processedCache.url);
      setProcessedCache(null);
    }
  }, [fileId]);

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