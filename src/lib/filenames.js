function sanitizeFilename(name) {
  if (!name) {
    return '';
  }
  return (
    name
      .toString()
      .normalize('NFKC')
      .trim()
      // Deliberately strips control characters (CR/LF included) to prevent
      // header/CRLF injection downstream.
      // eslint-disable-next-line no-control-regex
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/\.+$/, '')
  );
}

module.exports = { sanitizeFilename };
