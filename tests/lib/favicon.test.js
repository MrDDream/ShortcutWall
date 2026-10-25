import { describe, it, expect } from 'vitest';

import { extractFaviconCandidates, isLocalHost } from '../../src/lib/favicon.js';

const BASE = 'https://example.com/fr/';
const urls = (html, base = BASE) => extractFaviconCandidates(html, base).map(({ url }) => url);

describe('favicon.extractFaviconCandidates', () => {
  it('ranks declared icons largest first, SVG above any raster', () => {
    const html = `
      <link rel="icon" href="/favicon.ico">
      <link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png">
      <link rel="apple-touch-icon" href="/apple.png">
      <link rel="icon" type="image/svg+xml" href="/icon.svg">
      <link rel="icon" sizes="192x192" href="/icon-192.png">`;

    expect(urls(html)).toEqual([
      'https://example.com/icon.svg',
      'https://example.com/icon-192.png',
      'https://example.com/apple.png',
      'https://example.com/icon-32.png',
      'https://example.com/favicon.ico',
    ]);
  });

  it('resolves relative hrefs against the given (post-redirect) page URL', () => {
    expect(urls('<link rel="icon" href="img/icon.png">', 'https://www.example.org/home/index.html')).toEqual([
      'https://www.example.org/home/img/icon.png',
    ]);
  });

  it('accepts unquoted attributes, "shortcut icon" and HTML-escaped hrefs', () => {
    const html = `<link rel=icon href=/a.png><link rel="shortcut icon" href="/b.ico?v=1&amp;x=2">`;
    expect(urls(html)).toEqual(['https://example.com/a.png', 'https://example.com/b.ico?v=1&x=2']);
  });

  it('ignores non-icon links, data: URIs and duplicate entries', () => {
    const html = `
      <link rel="stylesheet" href="/style.css">
      <link rel="mask-icon" href="/mask.svg">
      <link rel="icon" href="data:image/png;base64,AAAA">
      <link rel="icon" href="/dup.png">
      <link rel="icon" href="/dup.png">`;

    expect(urls(html)).toEqual(['https://example.com/dup.png']);
  });
});

describe('favicon.isLocalHost', () => {
  it('recognises private addresses and local names, which are never sent to Google', () => {
    for (const url of [
      'http://192.168.1.254/',
      'https://10.0.0.5:8006/',
      'http://[fd12::1]/',
      'http://127.0.0.1:8080/',
      'http://nas:5000/',
      'https://nas.lan/',
      'http://printer.local/',
      'http://router.home.arpa/',
    ]) {
      expect(isLocalHost(url), url).toBe(true);
    }
  });

  it('treats public names and addresses as public', () => {
    for (const url of ['https://github.com/', 'http://93.184.216.34/', 'https://www.lemonde.fr/']) {
      expect(isLocalHost(url), url).toBe(false);
    }
  });
});
