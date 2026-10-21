import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { removeOrphanUploads, MIN_AGE_MS } from '../../src/lib/uploadsCleanup.js';
import { createRequire } from 'module';

// Same CommonJS instance as the one uploadsCleanup.js require()s: an ESM import
// would load a separate copy with its own (empty) list of pending deletions.
const { stash, pop } = createRequire(import.meta.url)('../../src/lib/trash.js');

describe('uploadsCleanup.removeOrphanUploads', () => {
  let uploadDir;
  let sitesFile;

  const now = Date.now();
  const writeUpload = (name, ageMs) => {
    const file = path.join(uploadDir, name);
    fs.writeFileSync(file, 'x');
    const time = (now - ageMs) / 1000;
    fs.utimesSync(file, time, time);
  };
  const writeSites = (sites) => fs.writeFileSync(sitesFile, JSON.stringify(sites));
  const run = () => removeOrphanUploads({ uploadDir, sitesFile, now });
  const remaining = () => fs.readdirSync(uploadDir).sort();

  beforeEach(() => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shortcutwall-cleanup-'));
    uploadDir = path.join(root, 'uploads');
    fs.mkdirSync(uploadDir);
    sitesFile = path.join(root, 'shortcuts.json');
  });

  afterEach(() => {
    fs.rmSync(path.dirname(uploadDir), { recursive: true, force: true });
  });

  it('removes old unreferenced files and keeps referenced or recent ones', async () => {
    writeSites([
      { id: '1', imageUrl: '/uploads/used.webp' },
      { id: '2', imageUrl: 'https://example.com/a.png' },
    ]);
    writeUpload('used.webp', 2 * MIN_AGE_MS);
    writeUpload('orphan.png', 2 * MIN_AGE_MS);
    writeUpload('just-fetched.webp', 60 * 1000);

    expect(await run()).toEqual(['orphan.png']);
    expect(remaining()).toEqual(['just-fetched.webp', 'used.webp']);
  });

  it('keeps the logo of a site still waiting in its undo window', async () => {
    writeSites([{ id: '1', imageUrl: '/uploads/used.webp' }]);
    writeUpload('used.webp', 2 * MIN_AGE_MS);
    writeUpload('being-undone.webp', 2 * MIN_AGE_MS);
    const token = stash({ type: 'site', item: { id: '2', imageUrl: '/uploads/being-undone.webp' } });

    try {
      expect(await run()).toEqual([]);
    } finally {
      pop(token);
    }
  });

  it('deletes nothing when the site list is empty (e.g. data volume not mounted)', async () => {
    writeSites([]);
    writeUpload('logo.webp', 2 * MIN_AGE_MS);

    expect(await run()).toEqual([]);
    expect(remaining()).toEqual(['logo.webp']);
  });

  it('deletes nothing when the sites file is unreadable', async () => {
    fs.writeFileSync(sitesFile, '{ not json');
    writeUpload('logo.webp', 2 * MIN_AGE_MS);

    await expect(run()).rejects.toThrow();
    expect(remaining()).toEqual(['logo.webp']);
  });
});
