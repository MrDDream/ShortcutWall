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

async function readFileAsJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(filePath, '[]', 'utf-8');
      return [];
    }
    throw error;
  }
}

async function writeFileAsJson(filePath, payload) {
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
}

function readJson(filePath) {
  return withLock(filePath, () => readFileAsJson(filePath));
}

function writeJson(filePath, payload) {
  return withLock(filePath, () => writeFileAsJson(filePath, payload));
}

// Runs an atomic read-modify-write cycle: `updater` receives the current array
// and returns the next one to persist, all under the same per-file lock.
// Throw NotFoundError from `updater` to signal a missing record to the caller.
function updateJson(filePath, updater) {
  return withLock(filePath, async () => {
    const current = await readFileAsJson(filePath);
    const next = await updater(current);
    await writeFileAsJson(filePath, next);
    return next;
  });
}

module.exports = { readJson, writeJson, updateJson, NotFoundError };
