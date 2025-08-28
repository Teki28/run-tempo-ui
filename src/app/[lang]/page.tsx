'use client'

import Image from 'next/image';
import Link from 'next/link';
import AudioUploader from '../../components/AudioUploader';
import { usePathname } from 'next/navigation';
import content from "../../content.json";

interface UploadResponse {
  preview_id: string; // This will be the preview_id
  message?: string;
  file_ids?: string[];
}

export default function Home() {
  type Validcontent = "en" | "zh" | "ja";
  const pathname = (usePathname()?.slice(1) || "en") as Validcontent;
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
              <h1 className="text-xl font-semibold text-gray-900">{content[pathname].header.title}</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link 
                href={`/${pathname}/blog/`} 
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-md border border-gray-300 transition-colors duration-150"
              >
                {pathname === 'en' ? 'Tutorial' : pathname === 'zh' ? '教程' : 'チュートリアル'}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Split Layout */}
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Side - App Functionality */}
            <div className="bg-white shadow-sm rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">{content[pathname].main.createMixTitle}</h2>
              <AudioUploader 
                lang={pathname}
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
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">{content[pathname].main.welcomeTitle}</h2>
                  <p className="text-lg text-gray-600">{content[pathname].main.welcomeSubtitle}</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{content[pathname].main.features.perfectTempo.title}</h3>
                      <p className="text-gray-600">{content[pathname].main.features.perfectTempo.description}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{content[pathname].main.features.customBPM.title}</h3>
                      <p className="text-gray-600">{content[pathname].main.features.customBPM.description}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{content[pathname].main.features.volumeControl.title}</h3>
                      <p className="text-gray-600">{content[pathname].main.features.volumeControl.description}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{content[pathname].main.features.instantDownload.title}</h3>
                      <p className="text-gray-600">{content[pathname].main.features.instantDownload.description}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="font-semibold text-gray-900 mb-2">{content[pathname]?.main?.howToGetStarted?.title}</h4>
                  <ol className="text-sm text-gray-600 space-y-1">
                    {content[pathname].main.howToGetStarted.steps.map((step, index) => (
                      <li key={index}>{index + 1}. {step}</li>
                    ))}
                  </ol>
                </div>

                <div className="text-center pt-4">
                  <p className="text-sm text-gray-500">
                    {content[pathname].footer}
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
