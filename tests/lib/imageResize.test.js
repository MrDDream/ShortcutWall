import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { describe, it, expect, afterEach } from 'vitest';

import { shrinkLogo, MAX_LOGO_SIZE } from '../../src/lib/imageResize.js';
import { shrinkUploadedLogo } from '../../src/lib/uploads.js';
import { UPLOAD_DIR } from '../../src/config.js';

const png = (width, height) =>
  sharp({ create: { width, height, channels: 4, background: { r: 90, g: 80, b: 230, alpha: 0.8 } } })
    .png()
    .toBuffer();

describe('imageResize.shrinkLogo', () => {
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
