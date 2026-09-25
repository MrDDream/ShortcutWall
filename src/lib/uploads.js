const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');

const { UPLOAD_DIR } = require('../config');
const { sanitizeFilename } = require('./filenames');
const logger = require('./logger');

fs.mkdir(UPLOAD_DIR, { recursive: true }).catch((error) => {
  logger.error({ err: error }, 'Unable to ensure upload directory');
});

// Raster formats only: SVG is deliberately excluded because it can embed
// <script> and would be served as-is from /uploads (stored XSS if opened directly).
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

class InvalidFileError extends Error {}

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
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new InvalidFileError('Unsupported file type.'));
    }
    cb(null, true);
  },
});

function buildUploadedPath(filename) {
  return `/uploads/${filename}`;
}

// Resolves a stored `/uploads/...` reference to an absolute path guaranteed to
// stay inside UPLOAD_DIR, or null if it isn't a legitimate uploaded asset.
// This defends against path traversal (e.g. "/uploads/../../../etc/passwd")
// even if such a value ever ends up stored, whatever its origin.
function resolveUploadPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/uploads/')) {
    return null;
  }

  const relative = value.slice('/uploads/'.length);
  const resolved = path.resolve(UPLOAD_DIR, relative);
  const uploadDirWithSep = UPLOAD_DIR.endsWith(path.sep) ? UPLOAD_DIR : `${UPLOAD_DIR}${path.sep}`;

  if (resolved !== UPLOAD_DIR && !resolved.startsWith(uploadDirWithSep)) {
    return null;
  }

  return resolved;
}

function isUploadedAsset(value) {
  return resolveUploadPath(value) !== null;
}

async function deleteUploadedAsset(value) {
  const absolutePath = resolveUploadPath(value);
  if (!absolutePath) {
    return;
  }
  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      logger.error({ err: error, path: absolutePath }, 'Unable to delete uploaded asset');
    }
  }
}

module.exports = { upload, buildUploadedPath, isUploadedAsset, deleteUploadedAsset, InvalidFileError };
