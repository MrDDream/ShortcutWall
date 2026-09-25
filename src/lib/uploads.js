const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');

const { UPLOAD_DIR, PUBLIC_DIR } = require('../config');
const { sanitizeFilename } = require('./filenames');

fs.mkdir(UPLOAD_DIR, { recursive: true }).catch((error) => {
  console.error('Unable to ensure upload directory', error);
});

const uploadStorage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const { name, ext } = path.parse(file.originalname);
    const safeName = sanitizeFilename(name || 'image');
    const timestamp = Date.now();
    cb(null, `${safeName}-${timestamp}${ext.toLowerCase()}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Seuls les fichiers image sont autorisés.'));
    }
    cb(null, true);
  },
});

function buildUploadedPath(filename) {
  return `/uploads/${filename}`;
}

function isUploadedAsset(value) {
  return typeof value === 'string' && value.startsWith('/uploads/');
}

async function deleteUploadedAsset(value) {
  if (!isUploadedAsset(value)) {
    return;
  }
  const absolutePath = path.join(PUBLIC_DIR, value.replace(/^\//, ''));
  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.error('Unable to delete uploaded asset', absolutePath, error);
    }
  }
}

module.exports = { upload, buildUploadedPath, isUploadedAsset, deleteUploadedAsset };
