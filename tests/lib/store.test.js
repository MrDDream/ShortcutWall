import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { readJson, updateJson, NotFoundError } from '../../src/lib/store.js';

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

  it('round-trips written data, leaving no temporary file behind', async () => {
    await updateJson(tmpFile, () => [{ id: '1' }]);
    expect(await readJson(tmpFile)).toEqual([{ id: '1' }]);
    expect(fs.readdirSync(tmpDir)).toEqual(['data.json']);
  });

  it('keeps the previous content when a write fails midway (atomic write)', async () => {
    await updateJson(tmpFile, () => [{ id: 'kept' }]);

    // A value JSON.stringify can't serialize makes the write throw.
    const circular = {};
    circular.self = circular;
    await expect(updateJson(tmpFile, () => [circular])).rejects.toThrow();

    expect(await readJson(tmpFile)).toEqual([{ id: 'kept' }]);
    expect(fs.readdirSync(tmpDir)).toEqual(['data.json']);
  });

  it('reuses the parsed content while the file is unchanged, and rereads it after a change', async () => {
    await updateJson(tmpFile, () => [{ id: 'a' }]);
    const first = await readJson(tmpFile);
    expect(await readJson(tmpFile)).toBe(first);

    // Edited outside the app (e.g. by hand): a new mtime/size invalidates the cache.
    fs.writeFileSync(tmpFile, JSON.stringify([{ id: 'a' }, { id: 'b' }]));
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(tmpFile, later, later);
    expect(await readJson(tmpFile)).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('never lets an update mutate data previously returned by readJson', async () => {
    await updateJson(tmpFile, () => [{ id: 'a' }]);
    const snapshot = await readJson(tmpFile);

    await updateJson(tmpFile, (items) => {
      items[0].id = 'changed';
      items.push({ id: 'b' });
      return items;
    });

    expect(snapshot).toEqual([{ id: 'a' }]);
    expect(await readJson(tmpFile)).toEqual([{ id: 'changed' }, { id: 'b' }]);
  });

  it('refuses a data file that is not a JSON array', async () => {
    fs.writeFileSync(tmpFile, '{"id": 1}');
    await expect(readJson(tmpFile)).rejects.toThrow(/JSON array/);
  });

  it('serializes concurrent updateJson calls without losing writes (regression test)', async () => {
    // Guards against the read-modify-write race that used to let concurrent
    // admin requests silently overwrite each other's changes.
    await updateJson(tmpFile, () => []);

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
    await updateJson(tmpFile, () => [{ id: 'a' }]);

    await expect(
      updateJson(tmpFile, () => {
        throw new NotFoundError();
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(await readJson(tmpFile)).toEqual([{ id: 'a' }]);
  });

  it('keeps the per-file queue usable after a failed update', async () => {
    await updateJson(tmpFile, () => []);
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
