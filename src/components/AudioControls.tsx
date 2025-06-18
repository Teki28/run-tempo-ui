'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useApiClient } from '@/lib/api-client';
import BpmControls from './BpmControls';

// Add this line to define API_URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface AudioControlsProps {
  fileId: string;
  onNewFile?: () => void;  // Called when a new file is uploaded or sample is loaded
  onDownloadSuccess?: () => void;  // Called when download is successful
}

interface AudioCache {
  bpm: number;
  volume: number;
  blob: Blob | null;
  url: string | null;
}

export default function AudioControls({ fileId, onNewFile, onDownloadSuccess }: AudioControlsProps) {
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isPlayingProcessed, setIsPlayingProcessed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bpm, setBpm] = useState(120);
  const [volume, setVolume] = useState(100);  // Default to 100% (normal volume)
  
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const processedAudioRef = useRef<HTMLAudioElement>(null);
  const audioCache = useRef<AudioCache>({ bpm: 0, volume: 0, blob: null, url: null });
  const currentBlobUrl = useRef<string | null>(null);
  const { processPreview, processRaw } = useApiClient();

  // Reset cache when fileId changes (new file uploaded or sample loaded)
  useEffect(() => {
    clearCache();
    if (onNewFile) {
      onNewFile();
    }
  }, [fileId, onNewFile]);

  const clearCache = () => {
    if (audioCache.current.url) {
      URL.revokeObjectURL(audioCache.current.url);
    }
    if (currentBlobUrl.current) {
      URL.revokeObjectURL(currentBlobUrl.current);
    }
    audioCache.current = { bpm: 0, volume: 0, blob: null, url: null };
    currentBlobUrl.current = null;
  };

  const handlePreviewPlay = () => {
    if (!previewAudioRef.current) return;

    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current.play();
    }
  };

  const processAndPlayAudio = async () => {
    if (!processedAudioRef.current) return;
    
    try {
      // Check if we have cached audio with the same settings
      if (audioCache.current.bpm === bpm && 
          audioCache.current.volume === volume && 
          audioCache.current.blob && 
          audioCache.current.url) {
        // Use cached audio without showing loading state
        console.log("Using cached audio");
        processedAudioRef.current.src = audioCache.current.url;
        processedAudioRef.current.load();
        await processedAudioRef.current.play();
        setIsPlayingProcessed(true);
        return;
      }

      // Only show loading state when making a new request
      setIsLoading(true);
      setError(null);

      // Clean up previous blob URL if it exists
      if (currentBlobUrl.current) {
        URL.revokeObjectURL(currentBlobUrl.current);
        currentBlobUrl.current = null;
      }

      // Get processed audio from backend using authenticated API
      const blob = await processPreview(fileId, bpm, volume);
      
      if (blob.size === 0) {
        throw new Error('Received empty audio data');
      }

      // Create new blob URL and cache it
      const url = URL.createObjectURL(blob);
      
      // Update cache
      if (audioCache.current.url) {
        URL.revokeObjectURL(audioCache.current.url);
      }
      audioCache.current = {
        bpm,
        volume,
        blob,
        url
      };
      currentBlobUrl.current = url;

      // Load and play the audio
      processedAudioRef.current.src = url;
      processedAudioRef.current.load();
      
      try {
        await processedAudioRef.current.play();
        setIsPlayingProcessed(true);
        setIsLoading(false);  // Clear loading state after successful play
      } catch (playError) {
        console.error('Error playing audio:', playError);
        throw new Error('Failed to play audio');
      }

    } catch (err) {
      console.error('Error processing audio:', err);
      setError(err instanceof Error ? err.message : 'Failed to play audio');
      setIsPlayingProcessed(false);
      setIsLoading(false);  // Make sure to clear loading state on error
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

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      setError(null);

      // Get processed raw file using authenticated API
      const blob = await processRaw(fileId, bpm, volume);

      // Create a download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `processed_${fileId}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (onDownloadSuccess) {
        onDownloadSuccess();
      }
    } catch (err) {
      console.error('Error downloading processed file:', err);
      setError(err instanceof Error ? err.message : 'Failed to download file');
    } finally {
      setIsDownloading(false);
    }
  };

  // Clean up blob URLs when component unmounts
  useEffect(() => {
    return () => {
      clearCache();
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

        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className={`flex items-center justify-center px-4 py-2 rounded-full text-white font-medium transition-colors
            ${isDownloading ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-500 hover:bg-purple-600'}
          `}
          title="Download the full audio with metronome"
        >
          {isDownloading ? (
            <div className="flex items-center">
              <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </div>
          ) : (
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Download Processed
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