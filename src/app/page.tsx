'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { pickLocale } from '@/lib/locales';

/**
 * Fallback locale redirect.
 *
 * In production the Cloudflare Pages function at functions/_middleware.ts
 * redirects "/" at the edge before this page is ever served. This exists so
 * `next dev` and any deploy without that function still land somewhere sensible.
 */
export default function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    const preferred = navigator.languages?.join(',') || navigator.language;
    router.replace(`/${pickLocale(preferred)}`);
  }, [router]);

  return null;
}
