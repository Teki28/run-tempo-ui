'use client';

import Image from 'next/image';
import Link from 'next/link';
import AudioUploader from './AudioUploader';
import content from '../content.json';
import type { Locale } from '@/lib/locales';

/** The four selling points, in render order. Keys index into content.json. */
const FEATURES = [
  { key: 'perfectTempo', ring: 'bg-blue-100', icon: 'text-blue-600' },
  { key: 'customBPM', ring: 'bg-green-100', icon: 'text-green-600' },
  { key: 'volumeControl', ring: 'bg-purple-100', icon: 'text-purple-600' },
  { key: 'instantDownload', ring: 'bg-yellow-100', icon: 'text-yellow-600' },
] as const;

const TUTORIAL_LABEL: Record<Locale, string> = {
  en: 'Tutorial',
  zh: '教程',
  ja: 'チュートリアル',
};

function CheckIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function HomeView({ lang }: { lang: Locale }) {
  const copy = content[lang];

  return (
    <main className="min-h-screen bg-gray-100">
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
              <h1 className="text-xl font-semibold text-gray-900">{copy.header.title}</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href={`/${lang}/blog/`}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-md border border-gray-300 transition-colors duration-150"
              >
                {TUTORIAL_LABEL[lang]}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white shadow-sm rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">{copy.main.createMixTitle}</h2>
              <AudioUploader lang={lang} />
            </div>

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
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">{copy.main.welcomeTitle}</h2>
                  <p className="text-lg text-gray-600">{copy.main.welcomeSubtitle}</p>
                </div>

                <div className="space-y-4">
                  {FEATURES.map(({ key, ring, icon }) => (
                    <div key={key} className="flex items-start gap-3">
                      <div
                        className={`flex-shrink-0 w-8 h-8 ${ring} rounded-full flex items-center justify-center`}
                      >
                        <CheckIcon className={`w-5 h-5 ${icon}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {copy.main.features[key].title}
                        </h3>
                        <p className="text-gray-600">{copy.main.features[key].description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    {copy.main.howToGetStarted.title}
                  </h4>
                  <ol className="text-sm text-gray-600 space-y-1">
                    {copy.main.howToGetStarted.steps.map((step, index) => (
                      <li key={step}>
                        {index + 1}. {step}
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="text-center pt-4">
                  <p className="text-sm text-gray-500">{copy.footer}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
