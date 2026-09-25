const crypto = require('crypto');

// Short-lived, in-process holding area for deleted items, so the admin UI can
// offer an "Undo" action right after a delete. Not persisted (a restart loses
// pending entries), which is an acceptable trade-off for a brief UX nicety —
// the confirmation dialog before delete remains the actual safety net.
const TTL_MS = 15000;

const entries = new Map();

// Stores `payload` under a fresh token; if it's never popped before TTL_MS
// elapses, `onExpire(payload)` runs once (e.g. to finally delete an uploaded
// asset that was kept around only in case of an undo).
function stash(payload, onExpire) {
  const token = crypto.randomBytes(16).toString('hex');
  const timer = setTimeout(() => {
    entries.delete(token);
    onExpire?.(payload);
  }, TTL_MS);
  timer.unref?.();
  entries.set(token, { payload, timer });
  return token;
}

// Removes and returns the stashed payload for `token`, or null if it was
// never stashed, already popped, or has expired.
function pop(token) {
  const entry = entries.get(token);
  if (!entry) {
    return null;
  }
  clearTimeout(entry.timer);
  entries.delete(token);
  return entry.payload;
}

module.exports = { stash, pop, TTL_MS };
