'use client';

import AudioUploader from '../components/AudioUploader';
import { useState, useEffect } from 'react';

interface UploadResponse {
  raw_id: string;
  preview_id: string | null;
  message: string;
}

export default function Home() {
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);

  const handleUploadComplete = (response: UploadResponse) => {
    console.log('Upload completed:', response);
    setUploadResponse(response);
  };

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);
  };

  return (
    <main className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow-sm rounded-lg p-6">
          <h1 className="text-2xl font-bold mb-6 text-gray-900">Audio Upload</h1>
          <AudioUploader 
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
          />
        </div>
      </div>
    </main>
  );
}
