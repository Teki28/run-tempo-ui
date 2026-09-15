import { notFound } from 'next/navigation';
import HomeView from '@/components/HomeView';
import { LOCALES, isLocale } from '@/lib/locales';

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <HomeView lang={lang} />;
}
