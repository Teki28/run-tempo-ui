'use client';

import React, { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
  audioUrl: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
console.log('AudioPlayer API_URL:', API_URL); // Debug log

export default function AudioPlayer({ audioUrl }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioSrc, setAudioSrc] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Ensure audioUrl starts with a slash
    const formattedUrl = audioUrl.startsWith('/') ? audioUrl : `/${audioUrl}`;
    const fullUrl = `${API_URL}${formattedUrl}`;
    console.log('Full audio URL:', fullUrl); // Debug log
    setAudioSrc(fullUrl);
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(error => {
        console.error('Audio playback error:', error); // Debug log
      });
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="flex items-center space-x-4">
      <button
        onClick={togglePlay}
        className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-full transition-colors"
      >
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <audio
        ref={audioRef}
        src={audioSrc || undefined}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onError={(e) => console.error('Audio element error:', e)} // Debug log
      />
    </div>
  );
} 