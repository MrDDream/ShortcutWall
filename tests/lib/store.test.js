import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { readJson, writeJson, updateJson, NotFoundError } from '../../src/lib/store.js';

describe('store', () => {
  let tmpDir;
  let tmpFile;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-test-'));
    tmpFile = path.join(tmpDir, 'data.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('self-heals a missing file into an empty array', async () => {
    const data = await readJson(tmpFile);
    expect(data).toEqual([]);
    expect(fs.existsSync(tmpFile)).toBe(true);
  });

  it('round-trips written data', async () => {
    await writeJson(tmpFile, [{ id: '1' }]);
    expect(await readJson(tmpFile)).toEqual([{ id: '1' }]);
  });

  it('serializes concurrent updateJson calls without losing writes (regression test)', async () => {
    // Guards against the read-modify-write race that used to let concurrent
    // admin requests silently overwrite each other's changes.
    await writeJson(tmpFile, []);

    await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        updateJson(tmpFile, (items) => {
          items.push({ id: String(index) });
          return items;
        }),
      ),
    );

    const final = await readJson(tmpFile);
    expect(final).toHaveLength(25);
    expect(new Set(final.map((item) => item.id)).size).toBe(25);
  });

  it('propagates a NotFoundError from the updater without writing', async () => {
    await writeJson(tmpFile, [{ id: 'a' }]);

    await expect(
      updateJson(tmpFile, () => {
        throw new NotFoundError();
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(await readJson(tmpFile)).toEqual([{ id: 'a' }]);
  });

  it('keeps the per-file queue usable after a failed update', async () => {
    await writeJson(tmpFile, []);
    await expect(
      updateJson(tmpFile, () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    await updateJson(tmpFile, (items) => {
      items.push({ id: 'after-failure' });
      return items;
    });

    expect(await readJson(tmpFile)).toEqual([{ id: 'after-failure' }]);
  });
});
