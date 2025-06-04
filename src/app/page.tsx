'use client';

import AudioUploader from '../components/AudioUploader';

interface UploadResponse {
  id: string;
  message: string;
}

export default function Home() {
  const handleUploadComplete = (response: UploadResponse) => {
    console.log('Upload completed:', response);
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
