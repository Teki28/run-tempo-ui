import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, isLocale, pickLocale } from './locales';

describe('pickLocale', () => {
  it.each([
    ['zh-CN,zh;q=0.9,en;q=0.8', 'zh'],
    ['ja', 'ja'],
    ['en-US,en;q=0.9', 'en'],
    ['zh-Hans-CN', 'zh'],
  ])('maps %s to %s', (header, expected) => {
    expect(pickLocale(header)).toBe(expected);
  });

  it('respects quality ordering rather than list order', () => {
    expect(pickLocale('de;q=0.9,ja;q=1.0')).toBe('ja');
  });

  it('skips languages we do not ship', () => {
    expect(pickLocale('de-DE,fr;q=0.9,ja;q=0.5')).toBe('ja');
  });

  it('ignores entries explicitly refused with q=0', () => {
    expect(pickLocale('ja;q=0,en;q=0.5')).toBe('en');
  });

  it.each([null, undefined, '', 'de-DE,fr;q=0.9'])('falls back to the default for %s', (header) => {
    expect(pickLocale(header)).toBe(DEFAULT_LOCALE);
  });
});

describe('isLocale', () => {
  it('accepts shipped locales and rejects others', () => {
    expect(isLocale('ja')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale('')).toBe(false);
  });
});
