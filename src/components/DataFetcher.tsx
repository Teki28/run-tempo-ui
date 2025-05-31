'use client';

import React, { useState } from 'react';
import AudioPlayer from './AudioPlayer';

interface ApiResponse {
  filename: string;
  duration_seconds: number;
  channels: number;
  sample_width_bytes: number;
  frame_rate_hz: number;
  frame_count: number;
  max_amplitude: number;
  rms: number;
  audio_url: string;
  target_bpm?: number;
  original_bpm?: number;
  target_bpm_applied?: number;
  shorter_file?: string;
  longer_file?: string;
  repeat_count?: number;
}

export default function DataFetcher() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('http://127.0.0.1:8000/');
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const jsonData = await response.json();
      console.log(jsonData);
      setData(jsonData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={fetchData}
        disabled={loading}
        className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:bg-blue-300"
      >
        {loading ? 'Loading...' : 'Fetch Data'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {data?.audio_url && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">Audio Player</h2>
          <AudioPlayer audioUrl={data.audio_url} />
        </div>
      )}

      {data && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2 text-gray-900">Response Data:</h2>
          <pre className="bg-gray-50 p-4 rounded-md overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
} 