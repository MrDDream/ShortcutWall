const sharp = require('sharp');

const logger = require('./logger');

// Logos are shown at 77px on the wall (154px on high-density screens): 256px
// leaves headroom while keeping each file to a few dozen KB, not megabytes.
const MAX_LOGO_SIZE = 256;

// Shrinks an image so its longest side is at most MAX_LOGO_SIZE, re-encoded as
// WebP (transparency kept, metadata dropped). Returns null when the image is
// already small enough or can't be decoded (e.g. ICO, which sharp doesn't
// read): callers then keep the original bytes.
async function shrinkLogo(buffer) {
  try {
    const image = sharp(buffer);
    const { width, height } = await image.metadata();
    if (!width || !height || Math.max(width, height) <= MAX_LOGO_SIZE) {
      return null;
    }

    return await image
      .resize(MAX_LOGO_SIZE, MAX_LOGO_SIZE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();
  } catch (error) {
    logger.warn({ err: error }, 'Unable to resize logo, keeping the original');
    return null;
  }
}

// True when the bytes are an SVG document (optionally after an XML
// declaration, comments or a doctype).
const SVG_START = /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<svg[\s>]/i;

function isSvg(buffer) {
  return SVG_START.test(
    buffer
      .subarray(0, 4096)
      .toString('utf-8')
      .replace(/^\uFEFF/, ''),
  );
}

// Renders an SVG logo to a MAX_LOGO_SIZE WebP, or returns null if it can't be
// read. The SVG itself is never stored or served: rendering keeps only pixels,
// so a <script> can't survive, and the renderer loads no external resource
// (file or URL). Rendered at the density that makes its longest side
// MAX_LOGO_SIZE, so a 16px icon comes out sharp, not upscaled.
async function rasterizeSvg(buffer) {
  try {
    const { width, height } = await sharp(buffer).metadata();
    const longest = Math.max(width || 0, height || 0) || MAX_LOGO_SIZE;
    const density = Math.min(Math.max((72 * MAX_LOGO_SIZE) / longest, 1), 2400);
    return await sharp(buffer, { density })
      .resize(MAX_LOGO_SIZE, MAX_LOGO_SIZE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();
  } catch (error) {
    logger.warn({ err: error }, 'Unable to render SVG logo');
    return null;
  }
}

// Identifies the format from the file's first bytes instead of trusting the
// remote Content-Type. Raster formats only: an SVG is never stored as such
// because it can embed scripts and /uploads is served from the app's own origin
// (stored XSS if opened directly); see rasterizeSvg.
function detectImageType(buffer) {
  const startsWith = (bytes, offset = 0) => bytes.every((byte, index) => buffer[offset + index] === byte);

  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'png';
  }
  if (startsWith([0xff, 0xd8, 0xff])) {
    return 'jpg';
  }
  if (startsWith([0x47, 0x49, 0x46, 0x38])) {
    return 'gif';
  }
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return 'webp';
  }
  if (startsWith([0x00, 0x00, 0x01, 0x00])) {
    return 'ico';
  }
  return null;
}

module.exports = { shrinkLogo, detectImageType, isSvg, rasterizeSvg, MAX_LOGO_SIZE };
