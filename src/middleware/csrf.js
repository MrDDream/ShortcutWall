const crypto = require('crypto');
const fs = require('fs').promises;

const { SESSION_SECRET } = require('../config');
const { readCookie } = require('../lib/cookies');

const TOKEN_BYTES = 32;
const LOGIN_COOKIE = 'login_csrf';
const LOGIN_COOKIE_MAX_AGE = 60 * 60 * 1000;

function constantTimeEqual(a, b) {
  const left = Buffer.from(typeof a === 'string' ? a : '');
  const right = Buffer.from(typeof b === 'string' ? b : '');
  // Lengths compared in bytes, not characters: timingSafeEqual throws on
  // buffers of different sizes (a non-ASCII token used to cause a 500).
  return right.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
}

// Exposes the session's CSRF token to the views of a logged-in admin. Anonymous
// visitors never get a session: the login form uses a signed cookie instead
// (see issueLoginCsrfToken), so bots hitting /admin/login no longer create a
// session file per visit.
function attachCsrfToken(req, res, next) {
  if (req.session?.isAuthenticated) {
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    }
    res.locals.csrfToken = req.session.csrfToken;
  }
  next();
}

// Multipart forms are parsed (and their file written to disk by multer) before
// the token can be read, so a rejected request's upload is removed here.
async function verifyCsrfToken(req, res, next) {
  if (!constantTimeEqual(req.body?._csrf, req.session?.csrfToken)) {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    return res.status(403).send(res.locals.t('errors.invalidCsrfToken'));
  }
  next();
}

function signLoginNonce(nonce) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(`login-csrf:${nonce}`).digest('hex');
}

// Login form CSRF without a server session ("signed double submit"): the same
// token goes in an HttpOnly cookie and in the form, and is signed with the
// session secret, so another site can neither read it nor forge one.
function issueLoginCsrfToken(req, res, next) {
  const nonce = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const token = `${nonce}.${signLoginNonce(nonce)}`;
  res.cookie(LOGIN_COOKIE, token, {
    maxAge: LOGIN_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'strict',
    secure: req.secure,
    path: '/admin/login',
  });
  res.locals.csrfToken = token;
  next();
}

function verifyLoginCsrfToken(req, res, next) {
  const cookieToken = readCookie(req, LOGIN_COOKIE);
  const [nonce, signature] = (cookieToken || '').split('.');
  const isValid =
    Boolean(nonce && signature) &&
    constantTimeEqual(signature, signLoginNonce(nonce)) &&
    constantTimeEqual(req.body?._csrf, cookieToken);

  if (!isValid) {
    return res.status(403).send(res.locals.t('errors.invalidCsrfToken'));
  }
  res.clearCookie(LOGIN_COOKIE, { path: '/admin/login' });
  next();
}

module.exports = { attachCsrfToken, verifyCsrfToken, issueLoginCsrfToken, verifyLoginCsrfToken };
