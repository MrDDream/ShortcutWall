const fsSync = require('fs');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');

const { UPLOAD_DIR } = require('../config');
const { sanitizeFilename } = require('./filenames');
const { shrinkLogo } = require('./imageResize');
const logger = require('./logger');

// Synchronous so the directory exists before any request (or test) writes to it.
fsSync.mkdirSync(UPLOAD_DIR, { recursive: true });

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

// Downsizes a freshly uploaded logo (see shrinkLogo) and returns the stored
// path to use: the WebP copy, replacing the original, or the original itself
// when it was already small enough or couldn't be processed.
async function shrinkUploadedLogo(filename) {
  const originalPath = path.join(UPLOAD_DIR, filename);
  try {
    const shrunk = await shrinkLogo(await fs.readFile(originalPath));
    if (!shrunk) {
      return buildUploadedPath(filename);
    }

    const resizedName = `${path.parse(filename).name}.webp`;
    await fs.writeFile(path.join(UPLOAD_DIR, resizedName), shrunk);
    if (resizedName !== filename) {
      await fs.unlink(originalPath).catch(() => {});
    }
    return buildUploadedPath(resizedName);
  } catch (error) {
    logger.warn({ err: error }, 'Unable to resize uploaded logo, keeping the original');
    return buildUploadedPath(filename);
  }
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

module.exports = {
  upload,
  buildUploadedPath,
  shrinkUploadedLogo,
  isUploadedAsset,
  deleteUploadedAsset,
  InvalidFileError,
};
