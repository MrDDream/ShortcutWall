import fs from 'fs';
import path from 'path';
import { describe, it, expect, afterEach } from 'vitest';

import { isUploadedAsset, deleteUploadedAsset, buildUploadedPath } from '../../src/lib/uploads.js';
import { UPLOAD_DIR } from '../../src/config.js';

describe('uploads path traversal protection', () => {
  afterEach(() => {
    const legit = path.join(UPLOAD_DIR, 'legit.png');
    if (fs.existsSync(legit)) {
      fs.unlinkSync(legit);
    }
  });

  it('accepts a plain uploaded filename', () => {
    expect(isUploadedAsset('/uploads/legit.png')).toBe(true);
  });

  it('rejects a path traversal attempt', () => {
    expect(isUploadedAsset('/uploads/../../../etc/passwd')).toBe(false);
    expect(isUploadedAsset('/uploads/../server.js')).toBe(false);
  });

  it('rejects non-string or unrelated values', () => {
    expect(isUploadedAsset(undefined)).toBe(false);
    expect(isUploadedAsset(null)).toBe(false);
    expect(isUploadedAsset('https://evil.com/x.png')).toBe(false);
    expect(isUploadedAsset('/etc/passwd')).toBe(false);
  });

  it('never deletes a file outside UPLOAD_DIR (regression test)', async () => {
    const outsideFile = path.join(UPLOAD_DIR, '..', 'canary.txt');
    fs.writeFileSync(outsideFile, 'do-not-delete');

    await deleteUploadedAsset('/uploads/../canary.txt');

    expect(fs.existsSync(outsideFile)).toBe(true);
    fs.unlinkSync(outsideFile);
  });

  it('deletes a file that is genuinely inside UPLOAD_DIR', async () => {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const target = path.join(UPLOAD_DIR, 'legit.png');
    fs.writeFileSync(target, 'fake-image-bytes');

    await deleteUploadedAsset(buildUploadedPath('legit.png'));

    expect(fs.existsSync(target)).toBe(false);
  });

  it('silently no-ops when the target file does not exist', async () => {
    await expect(deleteUploadedAsset('/uploads/never-existed.png')).resolves.toBeUndefined();
  });
});
