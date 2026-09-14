export const LOCALES = ['en', 'zh', 'ja'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Choose a locale from an Accept-Language header.
 *
 * Deliberately simple: match the primary subtag of each entry in the order the
 * browser listed them, honouring quality values, and fall back to English.
 * Shared by the Cloudflare Pages function and the client-side fallback so both
 * pick the same locale for the same visitor.
 */
export function pickLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith('q='))
        ?.slice(2);
      const quality = q === undefined ? 1 : Number.parseFloat(q);
      return { tag: tag.trim().toLowerCase(), quality: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((entry) => entry.tag && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of ranked) {
    const primary = tag.split('-')[0];
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}
