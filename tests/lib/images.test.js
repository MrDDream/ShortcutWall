import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { describe, it, expect, afterEach } from 'vitest';

import { shrinkLogo, detectImageType, MAX_LOGO_SIZE } from '../../src/lib/images.js';
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
