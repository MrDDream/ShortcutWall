import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/lib/ssrfGuard.js', () => ({
  assertPublicHost: vi.fn().mockResolvedValue(undefined),
}));

import { normalizeTargetUrl, normalizeImageUrl, normalizeNetworkPath } from '../../src/lib/urlUtils.js';

describe('normalizeTargetUrl', () => {
  it('accepts http(s) URLs', () => {
    expect(normalizeTargetUrl('https://example.com')).toBe('https://example.com/');
    expect(normalizeTargetUrl('http://example.com/path')).toBe('http://example.com/path');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeTargetUrl('  https://example.com  ')).toBe('https://example.com/');
  });

  it('rejects non-http(s) protocols', () => {
    expect(() => normalizeTargetUrl('javascript:alert(1)')).toThrow();
    expect(() => normalizeTargetUrl('ftp://example.com')).toThrow();
    expect(() => normalizeTargetUrl('file:///etc/passwd')).toThrow();
  });

  it('rejects an empty value', () => {
    expect(() => normalizeTargetUrl('')).toThrow();
    expect(() => normalizeTargetUrl('   ')).toThrow();
    expect(() => normalizeTargetUrl(undefined)).toThrow();
  });

  it('rejects a malformed URL', () => {
    expect(() => normalizeTargetUrl('not a url')).toThrow();
  });
});

describe('normalizeImageUrl', () => {
  it('returns an empty string unchanged', () => {
    expect(normalizeImageUrl('')).toBe('');
    expect(normalizeImageUrl(undefined)).toBe('');
    expect(normalizeImageUrl('   ')).toBe('');
  });

  it('accepts a safe single-segment uploaded asset reference', () => {
    expect(normalizeImageUrl('/uploads/logo.png')).toBe('/uploads/logo.png');
  });

  it('rejects a path traversal attempt (regression test)', () => {
    expect(() => normalizeImageUrl('/uploads/../../../../etc/passwd')).toThrow();
    expect(() => normalizeImageUrl('/uploads/../server.js')).toThrow();
    expect(() => normalizeImageUrl('/uploads/sub/dir.png')).toThrow();
  });

  it('accepts a proper http(s) URL', () => {
    expect(normalizeImageUrl('https://example.com/logo.png')).toBe('https://example.com/logo.png');
  });

  it('rejects a javascript: URL', () => {
    expect(() => normalizeImageUrl('javascript:alert(1)')).toThrow();
  });
});

describe('normalizeNetworkPath', () => {
  it('converts a backslash-prefixed path with mixed slashes to a pure UNC path', () => {
    expect(normalizeNetworkPath('\\\\server/share/sub')).toBe('\\\\server\\share\\sub');
  });

  it('leaves a plain forward-slash path untouched (not backslash-prefixed)', () => {
    expect(normalizeNetworkPath('//server/share')).toBe('//server/share');
  });

  it('passes through an existing file:// URL unchanged', () => {
    expect(normalizeNetworkPath('file:///C:/data')).toBe('file:///C:/data');
  });

  it('passes through an already backslash-style UNC path', () => {
    expect(normalizeNetworkPath('\\\\server\\share')).toBe('\\\\server\\share');
  });

  it('returns an empty string for empty input', () => {
    expect(normalizeNetworkPath('')).toBe('');
    expect(normalizeNetworkPath('   ')).toBe('');
  });
});
