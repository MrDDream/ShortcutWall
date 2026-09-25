const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

function createInternetShortcutPayload(target) {
  const cleaned = target.toString().replace(/\r?\n/g, '').trim();
  const normalized = cleaned.normalize('NFKC');
  return `[InternetShortcut]\r\nURL=${normalized}\r\n`;
}

function sendInternetShortcut(res, filename, payload) {
  const fileLabel = filename.replace(/"/g, "'");
  const encoded = encodeURIComponent(filename);
  // Prepending the byte-order mark is what makes Windows correctly detect the
  // UTF-16LE encoding of the generated .url file.
  const buffer = Buffer.from(`${BYTE_ORDER_MARK}${payload}`, 'utf16le');
  res.setHeader('Content-Disposition', `attachment; filename="${fileLabel}"; filename*=UTF-8''${encoded}`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}

module.exports = { createInternetShortcutPayload, sendInternetShortcut };
