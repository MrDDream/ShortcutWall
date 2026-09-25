const fs = require('fs').promises;

async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await writeJson(filePath, []);
      return [];
    }
    throw error;
  }
}

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
}

module.exports = { readJson, writeJson };
