import { describe, it, expect, vi } from 'vitest';

import { attachCsrfToken, verifyCsrfToken } from '../../src/middleware/csrf.js';

function mockRes() {
  return {
    locals: { t: (key) => key },
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}

describe('attachCsrfToken', () => {
  it('does nothing when there is no session', () => {
    const req = {};
    const res = mockRes();
    const next = vi.fn();

    attachCsrfToken(req, res, next);

    expect(res.locals.csrfToken).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it('generates and exposes a token for an authenticated session', () => {
    const req = { session: { isAuthenticated: true }, path: '/admin' };
    const res = mockRes();

    attachCsrfToken(req, res, () => {});

    expect(req.session.csrfToken).toMatch(/^[0-9a-f]{64}$/);
    expect(res.locals.csrfToken).toBe(req.session.csrfToken);
  });

  it('generates a token on the login page for an unauthenticated session', () => {
    const req = { session: {}, path: '/admin/login' };
    const res = mockRes();

    attachCsrfToken(req, res, () => {});

    expect(res.locals.csrfToken).toBeDefined();
  });

  it('does not generate a token for an unauthenticated, non-login page', () => {
    const req = { session: {}, path: '/' };
    const res = mockRes();

    attachCsrfToken(req, res, () => {});

    expect(res.locals.csrfToken).toBeUndefined();
  });

  it('reuses an existing token instead of rotating it', () => {
    const req = { session: { isAuthenticated: true, csrfToken: 'existing-token' }, path: '/admin' };
    const res = mockRes();

    attachCsrfToken(req, res, () => {});

    expect(req.session.csrfToken).toBe('existing-token');
  });
});

describe('verifyCsrfToken', () => {
  it('rejects a request with no session token', () => {
    const req = { session: {}, body: { _csrf: 'anything' } };
    const res = mockRes();
    const next = vi.fn();

    verifyCsrfToken(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a request with no submitted token', () => {
    const req = { session: { csrfToken: 'a'.repeat(64) }, body: {} };
    const res = mockRes();
    const next = vi.fn();

    verifyCsrfToken(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a mismatched token', () => {
    const req = { session: { csrfToken: 'a'.repeat(64) }, body: { _csrf: 'b'.repeat(64) } };
    const res = mockRes();
    const next = vi.fn();

    verifyCsrfToken(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects tokens of differing length without throwing', () => {
    const req = { session: { csrfToken: 'a'.repeat(64) }, body: { _csrf: 'short' } };
    const res = mockRes();
    const next = vi.fn();

    expect(() => verifyCsrfToken(req, res, next)).not.toThrow();
    expect(res.statusCode).toBe(403);
  });

  it('accepts a matching token', () => {
    const token = 'a'.repeat(64);
    const req = { session: { csrfToken: token }, body: { _csrf: token } };
    const res = mockRes();
    const next = vi.fn();

    verifyCsrfToken(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBeNull();
  });
});
