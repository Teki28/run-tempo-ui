'use client';

import Image from 'next/image';
import AudioUploader from '../components/AudioUploader';
import { AuthButton } from '../components/AuthButton';

interface UploadResponse {
  id: string;
  message?: string;
}

export default function Home() {
  const handleUploadComplete = (response: UploadResponse) => {
    console.log('Upload completed:', response);
  };

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);
  };

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Image
                src="/app_logo.jpg"
                alt="Run Pulse Logo"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <h1 className="text-xl font-semibold text-gray-900">Run Pulse</h1>
            </div>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Main Content - Split Layout */}
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Side - App Functionality */}
            <div className="bg-white shadow-sm rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">Create Your Running Mix</h2>
              <AudioUploader 
                onUploadComplete={handleUploadComplete}
                onUploadError={handleUploadError}
              />
            </div>

            {/* Right Side - Landing Page Introduction */}
            <div className="bg-white shadow-sm rounded-lg p-6">
              <div className="space-y-6">
                <div className="text-center">
                  <Image
                    src="/app_logo.jpg"
                    alt="Run Pulse Logo"
                    width={120}
                    height={120}
                    className="rounded-xl mx-auto mb-4"
                  />
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Run Pulse</h2>
                  <p className="text-lg text-gray-600">Transform your music to match your running pace</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Perfect Running Tempo</h3>
                      <p className="text-gray-600">Upload your favorite music and we'll add a metronome that matches your target running pace.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Customizable BPM</h3>
                      <p className="text-gray-600">Adjust the beats per minute to match your exact running speed and training goals.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Volume Control</h3>
                      <p className="text-gray-600">Fine-tune the metronome volume to blend perfectly with your music.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Instant Download</h3>
                      <p className="text-gray-600">Get your processed audio file ready for your next run in seconds.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="font-semibold text-gray-900 mb-2">How to Get Started</h4>
                  <ol className="text-sm text-gray-600 space-y-1">
                    <li>1. <strong>Try Sample Music</strong> - Test the app with our demo track</li>
                    <li>2. <strong>Sign Up</strong> - Create an account to upload your own music</li>
                    <li>3. <strong>Upload & Process</strong> - Add your MP3 and adjust BPM/volume</li>
                    <li>4. <strong>Download & Run</strong> - Get your tempo-synced music ready for your workout</li>
                  </ol>
                </div>

                <div className="text-center pt-4">
                  <p className="text-sm text-gray-500">
                    Perfect for runners, joggers, and anyone who wants to maintain a consistent pace during their workouts.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
