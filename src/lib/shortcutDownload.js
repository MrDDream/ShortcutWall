function createInternetShortcutPayload(target) {
  const cleaned = target.toString().replace(/\r?\n/g, '').trim();
  const normalized = cleaned.normalize('NFKC');
  return `[InternetShortcut]\r\nURL=${normalized}\r\n`;
}

function sendInternetShortcut(res, filename, payload) {
  const fileLabel = filename.replace(/"/g, "'");
  const encoded = encodeURIComponent(filename);
  const buffer = Buffer.from(`﻿${payload}`, 'utf16le');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${fileLabel}"; filename*=UTF-8''${encoded}`,
  );
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}

module.exports = { createInternetShortcutPayload, sendInternetShortcut };
