import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { describe, it, expect, afterEach } from 'vitest';

import { shrinkLogo, detectImageType, isSvg, rasterizeSvg, MAX_LOGO_SIZE } from '../../src/lib/images.js';
import { shrinkUploadedLogo } from '../../src/lib/uploads.js';
import { UPLOAD_DIR } from '../../src/config.js';

const png = (width, height) =>
  sharp({ create: { width, height, channels: 4, background: { r: 90, g: 80, b: 230, alpha: 0.8 } } })
    .png()
    .toBuffer();

describe('images.shrinkLogo', () => {
  it('downsizes a large image to fit MAX_LOGO_SIZE, keeping ratio and transparency, as WebP', async () => {
    const shrunk = await shrinkLogo(await png(1254, 627));
    const meta = await sharp(shrunk).metadata();

    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(MAX_LOGO_SIZE);
    expect(meta.height).toBe(MAX_LOGO_SIZE / 2);
    expect(meta.hasAlpha).toBe(true);
  });

  it('leaves an image that is already small enough alone', async () => {
    expect(await shrinkLogo(await png(MAX_LOGO_SIZE, 100))).toBeNull();
  });

  it('returns null for data it cannot decode instead of throwing', async () => {
    expect(await shrinkLogo(Buffer.from('not an image'))).toBeNull();
  });
});

describe('uploads.shrinkUploadedLogo', () => {
  const created = [];
  const write = async (name, buffer) => {
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer);
    created.push(name);
  };

  afterEach(() => {
    for (const name of created.splice(0)) {
      fs.rmSync(path.join(UPLOAD_DIR, name), { force: true });
      fs.rmSync(path.join(UPLOAD_DIR, `${path.parse(name).name}.webp`), { force: true });
    }
  });

  it('replaces an oversized upload with a downsized WebP copy', async () => {
    await write('test-big-logo.png', await png(1000, 1000));

    const stored = await shrinkUploadedLogo('test-big-logo.png');

    expect(stored).toBe('/uploads/test-big-logo.webp');
    expect(fs.existsSync(path.join(UPLOAD_DIR, 'test-big-logo.png'))).toBe(false);
    const meta = await sharp(path.join(UPLOAD_DIR, 'test-big-logo.webp')).metadata();
    expect(Math.max(meta.width, meta.height)).toBe(MAX_LOGO_SIZE);
  });

  it('keeps a small upload untouched', async () => {
    await write('test-small-logo.png', await png(64, 64));

    expect(await shrinkUploadedLogo('test-small-logo.png')).toBe('/uploads/test-small-logo.png');
    expect(fs.existsSync(path.join(UPLOAD_DIR, 'test-small-logo.png'))).toBe(true);
  });
});

const bytes = (...values) => Buffer.from(values);

describe('images.detectImageType', () => {
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

describe('images.isSvg / rasterizeSvg', () => {
  const svg = (body, attrs = 'viewBox="0 0 16 16"') =>
    Buffer.from(`<?xml version="1.0"?>\n<!-- icon -->\n<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`);

  it('recognises SVG documents, and only them', () => {
    expect(isSvg(svg('<rect width="16" height="16"/>'))).toBe(true);
    expect(isSvg(Buffer.from('﻿<svg>'))).toBe(true);
    expect(isSvg(Buffer.from('<html><svg></svg></html>'))).toBe(false);
    expect(isSvg(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });

  it('renders a small icon sharp at MAX_LOGO_SIZE, as WebP', async () => {
    const out = await rasterizeSvg(svg('<rect width="16" height="16" fill="#5b55ea"/>'));
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width, meta.height)).toBe(MAX_LOGO_SIZE);
  });

  it('keeps only pixels: scripts are gone and external files are never loaded', async () => {
    const hostile = svg(
      '<script>alert(1)</script><image href="file:///etc/hostname" width="64" height="64"/>',
      'width="64" height="64"',
    );
    const out = await rasterizeSvg(hostile);
    expect(out.includes(Buffer.from('script'))).toBe(false);
    // Nothing was drawn: the only element is the external image, refused.
    const { channels } = await sharp(out).stats();
    expect(channels[3].max).toBe(0);
  });

  it('returns null for an SVG it cannot render (entity bomb, absurd size)', async () => {
    // Billion laughs: each entity expands to ten of the previous one.
    const levels = ['<!ENTITY e0 "aaaaaaaaaa">'];
    for (let i = 1; i < 7; i += 1) {
      levels.push(`<!ENTITY e${i} "${`&e${i - 1};`.repeat(10)}">`);
    }
    const bomb = Buffer.from(
      `<?xml version="1.0"?><!DOCTYPE l [${levels.join('')}]>` +
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><text>&e6;</text></svg>',
    );
    expect(await rasterizeSvg(bomb)).toBeNull();
    expect(await rasterizeSvg(svg('', 'width="100000" height="100000"'))).toBeNull();
  });
});
