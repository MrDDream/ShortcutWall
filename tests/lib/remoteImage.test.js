import { describe, it, expect } from 'vitest';

import { detectImageType, importRemoteImage } from '../../src/lib/remoteImage.js';

const bytes = (...values) => Buffer.from(values);

describe('remoteImage.detectImageType', () => {
  it('recognises the supported raster formats from their signature', () => {
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))).toBe('png');
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpg');
    expect(detectImageType(Buffer.from('GIF89a'))).toBe('gif');
    expect(detectImageType(Buffer.concat([Buffer.from('RIFF'), bytes(0, 0, 0, 0), Buffer.from('WEBPVP8 ')]))).toBe(
      'webp',
    );
    expect(detectImageType(bytes(0x00, 0x00, 0x01, 0x00, 0x01))).toBe('ico');
  });

  it('refuses SVG, HTML and anything unknown, whatever the server claimed', () => {
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))).toBeNull();
    expect(detectImageType(Buffer.from('<!DOCTYPE html><html>'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe('remoteImage.importRemoteImage', () => {
  it('returns null for invalid or non-http(s) URLs', async () => {
    expect(await importRemoteImage('not a url')).toBeNull();
    expect(await importRemoteImage('file:///etc/passwd')).toBeNull();
    expect(await importRemoteImage('/uploads/logo.png')).toBeNull();
  });

  it('never fetches from a non-public host (SSRF guard)', async () => {
    expect(await importRemoteImage('http://127.0.0.1/logo.png')).toBeNull();
    expect(await importRemoteImage('http://169.254.169.254/latest/meta-data')).toBeNull();
  });
});
