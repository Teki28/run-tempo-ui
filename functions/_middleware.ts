import { LOCALES, pickLocale } from '../src/lib/locales';

/**
 * Locale redirect at the edge.
 *
 * Replaces the Next.js middleware, which cannot run in a static export. Kept
 * deliberately tiny — it is the only server-side code left in the project.
 */
interface Context {
  request: Request;
  next: () => Promise<Response>;
}

const HAS_EXTENSION = /\.[a-z0-9]+$/i;

export const onRequest = async (context: Context): Promise<Response> => {
  const url = new URL(context.request.url);
  const { pathname } = url;

  const alreadyLocalised = LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  // Static assets (/_next/*.js, /audio/click.wav, /favicon.ico) must not be
  // rewritten; anything with a file extension is left alone.
  if (alreadyLocalised || pathname.startsWith('/_next/') || HAS_EXTENSION.test(pathname)) {
    return context.next();
  }

  const locale = pickLocale(context.request.headers.get('Accept-Language'));
  url.pathname = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;
  return Response.redirect(url.toString(), 302);
};
