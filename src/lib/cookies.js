// Reads one cookie from the request's Cookie header, or null. Small enough not
// to warrant a cookie-parser dependency.
function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator !== -1 && part.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

module.exports = { readCookie };
