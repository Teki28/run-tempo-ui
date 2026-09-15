import { LOCALES, pickLocale } from '../src/lib/locales';

/**
 * Minimal shape of the static-asset binding. Declared inline rather than
 * pulling in @cloudflare/workers-types for a single method.
 */
interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

const HAS_EXTENSION = /\.[a-z0-9]+$/i;

/**
 * Serve a static asset, substituting the exported 404 page for misses.
 *
 * The asset binding answers an unmatched path with an empty 404. wrangler's
 * `not_found_handling` would supply the styled page, but it resolves *before*
 * the Worker runs, so unprefixed paths like /blog would 404 instead of being
 * redirected. Handling it here keeps both behaviours.
 */
async function serveAsset(request: Request, env: Env, url: URL): Promise<Response> {
  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404) return response;

  const fallback = await env.ASSETS.fetch(new Request(new URL('/404.html', url).toString()));
  return new Response(fallback.body, { status: 404, headers: fallback.headers });
}

/**
 * The only server-side code in the project: an Accept-Language redirect.
 *
 * wrangler.jsonc runs this Worker first for "/" alone. Every other request
 * either matches a static asset — served directly, and free — or falls through
 * to here when nothing matches, so the common path never invokes the Worker.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    const alreadyLocalised = LOCALES.some(
      (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
    );
    // Static assets must never be rewritten.
    if (alreadyLocalised || pathname.startsWith('/_next/') || HAS_EXTENSION.test(pathname)) {
      return serveAsset(request, env, url);
    }

    const locale = pickLocale(request.headers.get('Accept-Language'));
    const target = pathname === '/' ? `/${locale}/` : `/${locale}${pathname}`;
    // next.config.mjs sets trailingSlash: true, so emitting the canonical path
    // here avoids a second redirect on a visitor's very first request.
    url.pathname = target.endsWith('/') ? target : `${target}/`;
    return Response.redirect(url.toString(), 302);
  },
};
