import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Run Pulse',
  description:
    'Overlay a customizable BPM tempo track onto your own music to match your running pace. Everything runs in your browser.',
};

/**
 * The single <html>/<body> shell. Locale layouts below this are pass-throughs;
 * having them render their own document produced nested <html> tags.
 *
 * suppressHydrationWarning is for browser extensions, which routinely stamp
 * their own classes and attributes onto <html> before React hydrates and
 * would otherwise fail every page with a mismatch. It is deliberately only
 * on this element: React applies it one level deep, so a genuine hydration
 * bug anywhere inside the app still reports normally.
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
