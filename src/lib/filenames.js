function sanitizeFilename(name) {
  if (!name) {
    return '';
  }
  return name
    .toString()
    .normalize('NFKC')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/, '');
}

function buildDownloadFilename(name, fallback) {
  const base = sanitizeFilename(name) || fallback;
  return base.replace(/[\s']+/g, '_');
}

module.exports = { sanitizeFilename, buildDownloadFilename };
