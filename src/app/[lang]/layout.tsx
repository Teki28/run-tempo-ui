import type { Metadata } from 'next';
import { LOCALES, isLocale } from '@/lib/locales';
import content from '../../content.json';

const DESCRIPTIONS: Record<string, string> = {
  en: 'Overlay a customizable BPM tempo track onto your own music to match your running pace. Everything runs in your browser.',
  zh: '在你的音乐上叠加可自定义的 BPM 节拍轨道，匹配你的跑步节奏。全部处理都在浏览器中完成。',
  ja: '自分の音楽にカスタマイズ可能なBPMテンポトラックを重ねて、ランニングのペースに合わせます。すべてブラウザ内で処理されます。',
};

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : 'en';
  return {
    title: content[locale].header.title,
    description: DESCRIPTIONS[locale],
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])),
    },
  };
}

/**
 * Pass-through. The <html>/<body> shell lives in the root layout — rendering it
 * here as well produced nested documents.
 */
export default function LocaleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
