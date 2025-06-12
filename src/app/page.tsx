'use client';

import AudioUploader from '../components/AudioUploader';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AuthButton } from '../components/AuthButton';

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
    <ProtectedRoute>
      <main className="min-h-screen bg-gray-100">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <h1 className="text-xl font-semibold text-gray-900">Run Tempo</h1>
              <AuthButton />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white shadow-sm rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">Audio Upload</h2>
              <AudioUploader 
                onUploadComplete={handleUploadComplete}
                onUploadError={handleUploadError}
              />
            </div>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
