const fs = require('fs').promises;

class NotFoundError extends Error {}

// Serializes all reads/writes per file path so that concurrent requests can no
// longer race on a read-modify-write cycle and silently overwrite each other's
// changes (lost update problem).
const locks = new Map();

function withLock(filePath, task) {
  const previous = locks.get(filePath) || Promise.resolve();
  const run = previous.then(task, task);
  locks.set(
    filePath,
    run.catch(() => {}),
  );
  return run;
}

// Parsed content of each data file, reused while the file is unchanged on
// disk (same modification time and size): nearly every request only reads it,
// and re-parsing the JSON for each page view is wasted work. What readJson
// returns is therefore shared: callers must treat it as read-only (updateJson
// hands its updater a private copy).
const cache = new Map();

async function readFileAsJson(filePath) {
  let stats;
  try {
    stats = await fs.stat(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(filePath, '[]', 'utf-8');
      return [];
    }
    throw error;
  }

  const cached = cache.get(filePath);
  if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
    return cached.data;
  }

  const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
  if (!Array.isArray(data)) {
    throw new Error(`${filePath} does not contain a JSON array`);
  }
  cache.set(filePath, { mtimeMs: stats.mtimeMs, size: stats.size, data });
  return data;
}

// Writes to a temporary file, flushes it to disk, then renames it over the
// target. A rename is atomic: a crash or restart mid-write leaves the previous
// version intact instead of a truncated file (which used to empty the wall and
// block every later save).
async function writeFileAsJson(filePath, payload) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    const handle = await fs.open(tempPath, 'w');
    try {
      await handle.writeFile(JSON.stringify(payload, null, 2), 'utf-8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {});
    throw error;
  }
}

function readJson(filePath) {
  return withLock(filePath, () => readFileAsJson(filePath));
}

// Runs an atomic read-modify-write cycle: `updater` receives the current array
// and returns the next one to persist, all under the same per-file lock.
// Throw NotFoundError from `updater` to signal a missing record to the caller.
function updateJson(filePath, updater) {
  return withLock(filePath, async () => {
    const current = structuredClone(await readFileAsJson(filePath));
    const next = await updater(current);
    await writeFileAsJson(filePath, next);
    return next;
  });
}

module.exports = { readJson, updateJson, NotFoundError };
