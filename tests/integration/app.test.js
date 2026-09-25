import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

// ES module imports are hoisted above all other top-level statements, so
// setting process.env here would run *after* a statically-imported src/app.js
// (and its src/config.js) had already read it. src/app.js is therefore loaded
// dynamically inside beforeAll, once these are guaranteed to be in place —
// this run must never touch the real data/ directory.
const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shortcutwall-test-'));
process.env.DATA_DIR = tmpDataDir;
process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef';
process.env.ADMIN_USER = 'testadmin';
process.env.ADMIN_PASS = 'testpassword123';
process.env.APP_DEFAULT_LOCALE = 'en';

function readData(filename) {
  return JSON.parse(fs.readFileSync(path.join(tmpDataDir, filename), 'utf-8'));
}

function extractCsrfToken(html) {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  return match ? match[1] : null;
}

describe('ShortcutWall app', () => {
  let app;
  let agent;

  beforeAll(async () => {
    const { default: createApp } = await import('../../src/app.js');
    app = createApp();
    agent = request.agent(app);
  });

  afterAll(() => {
    fs.rmSync(tmpDataDir, { recursive: true, force: true });
  });

  it('serves the public homepage', async () => {
    const res = await agent.get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('ShortcutWall');
  });

  it('answers the health check without requiring auth', async () => {
    const res = await agent.get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns 404 for an unknown route', async () => {
    const res = await agent.get('/this-does-not-exist');
    expect(res.status).toBe(404);
  });

  it('redirects an unauthenticated visitor away from /admin', async () => {
    const freshAgent = request.agent(app);
    const res = await freshAgent.get('/admin');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin/login');
  });

  it('rejects a login POST with no CSRF token', async () => {
    const freshAgent = request.agent(app);
    const res = await freshAgent
      .post('/admin/login')
      .type('form')
      .send({ username: 'testadmin', password: 'testpassword123' });
    expect(res.status).toBe(403);
  });

  it('rejects login with wrong credentials', async () => {
    const freshAgent = request.agent(app);
    const loginPage = await freshAgent.get('/admin/login');
    const csrf = extractCsrfToken(loginPage.text);

    const res = await freshAgent
      .post('/admin/login')
      .type('form')
      .send({ username: 'testadmin', password: 'wrong', _csrf: csrf });

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/invalid/i);
  });

  it('logs in with the correct credentials and a valid CSRF token', async () => {
    const loginPage = await agent.get('/admin/login');
    const csrf = extractCsrfToken(loginPage.text);

    const res = await agent
      .post('/admin/login')
      .type('form')
      .send({ username: 'testadmin', password: 'testpassword123', _csrf: csrf });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin');
  });

  describe('once authenticated', () => {
    it('creates, lists and deletes a folder', async () => {
      const dashboard = await agent.get('/admin?tab=folders');
      const csrf = extractCsrfToken(dashboard.text);

      const createRes = await agent
        .post('/admin/folder')
        .type('form')
        .send({ name: 'Test Folder', networkPath: '\\\\server\\share', _csrf: csrf });

      expect(createRes.status).toBe(302);
      expect(createRes.headers.location).toBe('/admin?tab=folders&status=created');
      expect(readData('folders.json')).toHaveLength(1);

      const [folder] = readData('folders.json');
      const deleteDashboard = await agent.get('/admin?tab=folders');
      const deleteCsrf = extractCsrfToken(deleteDashboard.text);

      const deleteRes = await agent.post(`/admin/folder/${folder.id}/delete`).type('form').send({ _csrf: deleteCsrf });

      expect(deleteRes.status).toBe(302);
      expect(readData('folders.json')).toHaveLength(0);
    });

    it('rejects a path traversal attempt through imageUrl on site creation (regression test)', async () => {
      const dashboard = await agent.get('/admin?tab=sites');
      const csrf = extractCsrfToken(dashboard.text);

      const res = await agent.post('/admin/site').type('form').send({
        name: 'Evil',
        targetUrl: 'https://example.com',
        imageUrl: '/uploads/../../../../etc/passwd',
        _csrf: csrf,
      });

      expect(res.status).toBe(400);
      expect(readData('shortcuts.json')).toHaveLength(0);
    });

    it('rejects an SSRF attempt through targetUrl on site creation', async () => {
      const dashboard = await agent.get('/admin?tab=sites');
      const csrf = extractCsrfToken(dashboard.text);

      const res = await agent.post('/admin/site').type('form').send({
        name: 'Internal',
        targetUrl: 'http://127.0.0.1:1/',
        _csrf: csrf,
      });

      expect(res.status).toBe(400);
      expect(readData('shortcuts.json')).toHaveLength(0);
    });

    it('creates a real reachable site end to end', async () => {
      const dashboard = await agent.get('/admin?tab=sites');
      const csrf = extractCsrfToken(dashboard.text);

      const res = await agent.post('/admin/site').type('form').send({
        name: 'Example',
        targetUrl: 'https://example.com',
        _csrf: csrf,
      });

      expect(res.status).toBe(302);
      const sites = readData('shortcuts.json');
      expect(sites).toHaveLength(1);
      expect(sites[0].name).toBe('Example');
    });

    it('logs out and revokes access to /admin', async () => {
      const dashboard = await agent.get('/admin');
      const csrf = extractCsrfToken(dashboard.text);

      const logoutRes = await agent.post('/admin/logout').type('form').send({ _csrf: csrf });
      expect(logoutRes.status).toBe(302);

      const res = await agent.get('/admin');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/admin/login');
    });
  });
});
