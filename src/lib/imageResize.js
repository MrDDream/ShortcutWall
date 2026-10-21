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

module.exports = { shrinkLogo, MAX_LOGO_SIZE };
