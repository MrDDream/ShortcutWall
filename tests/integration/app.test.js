import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';

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

function writeData(filename, data) {
  fs.writeFileSync(path.join(tmpDataDir, filename), JSON.stringify(data, null, 2), 'utf-8');
}

// A stored site, written straight to the data file: deleting/restoring never
// checks reachability, so these tests need no network access.
function seededSite(overrides = {}) {
  return {
    id: 'site-1',
    name: 'Site',
    description: '',
    targetUrl: 'https://example.com/',
    imageUrl: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
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

  it('offers every language, each under its own name, and links to the GitHub project', async () => {
    const res = await agent.get('/');
    expect(res.text).toContain('href="/language/fr"');
    expect(res.text).toContain('href="/language/en"');
    expect(res.text).toContain('Français');
    expect(res.text).toContain('English');
    expect(res.text).toMatch(/href="\/language\/en"[^>]*aria-current="true"/);
    expect(res.text).toContain('href="https://github.com/MrDDream/ShortcutWall"');
  });

  it('never creates a server session for an anonymous visitor', async () => {
    const res = await request(app).get('/');
    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.some((cookie) => cookie.startsWith('connect.sid='))).toBe(false);
  });

  it('remembers the chosen language in a cookie, without a session', async () => {
    const switchRes = await request(app).get('/language/fr');
    expect(switchRes.status).toBe(302);
    const cookies = switchRes.headers['set-cookie'] || [];
    const langCookie = cookies.find((cookie) => cookie.startsWith('lang=fr'));
    expect(langCookie).toMatch(/HttpOnly/i);
    expect(cookies.some((cookie) => cookie.startsWith('connect.sid='))).toBe(false);

    const page = await request(app).get('/').set('Cookie', 'lang=fr');
    expect(page.text).toContain('<html lang="fr">');
  });

  it('does not force assets to https, so plain-HTTP LAN deployments still load CSS/JS', async () => {
    const res = await agent.get('/');
    expect(res.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
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
    it('deletes a site', async () => {
      writeData('shortcuts.json', [seededSite({ id: 'delete-me', name: 'Delete Me' })]);
      const csrf = extractCsrfToken((await agent.get('/admin')).text);

      const res = await agent.post('/admin/site/delete-me/delete').type('form').send({ _csrf: csrf });

      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/^\/admin\?status=deleted&undoToken=/);
      expect(readData('shortcuts.json')).toHaveLength(0);
    });

    it('restores a deleted site via its undo token', async () => {
      writeData('shortcuts.json', [seededSite({ id: 'undo-me', name: 'Undo Me' })]);
      const csrf = extractCsrfToken((await agent.get('/admin')).text);

      const deleteRes = await agent.post('/admin/site/undo-me/delete').type('form').send({ _csrf: csrf });
      expect(readData('shortcuts.json')).toHaveLength(0);

      const undoToken = new URL(deleteRes.headers.location, 'http://localhost').searchParams.get('undoToken');
      expect(undoToken).toBeTruthy();

      const bannerPage = await agent.get(deleteRes.headers.location);
      expect(bannerPage.text).toContain(`data-undo-token="${undoToken}"`);
      const restoreCsrf = extractCsrfToken(bannerPage.text);

      const restoreRes = await agent
        .post(`/admin/trash/${undoToken}/restore`)
        .type('form')
        .send({ _csrf: restoreCsrf });

      expect(restoreRes.status).toBe(302);
      expect(restoreRes.headers.location).toBe('/admin?status=restored');

      const restored = readData('shortcuts.json');
      expect(restored).toHaveLength(1);
      expect(restored[0].id).toBe('undo-me');
      expect(restored[0].name).toBe('Undo Me');

      // Clean up so later tests in this file see an empty list again.
      writeData('shortcuts.json', []);
    });

    it('restoring an unknown or already-used undo token is a harmless no-op', async () => {
      const dashboard = await agent.get('/admin');
      const csrf = extractCsrfToken(dashboard.text);

      const res = await agent.post('/admin/trash/does-not-exist/restore').type('form').send({ _csrf: csrf });

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/admin');
    });

    it('rejects a path traversal attempt through imageUrl on site creation (regression test)', async () => {
      const dashboard = await agent.get('/admin');
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
      const dashboard = await agent.get('/admin');
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
      const dashboard = await agent.get('/admin');
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

    describe('backup export / import', () => {
      const uploadDir = process.env.UPLOAD_DIR;
      let logoBytes;

      const backupFile = (sites, extra = {}) =>
        Buffer.from(JSON.stringify({ app: 'ShortcutWall', version: 1, exportedAt: '', sites, ...extra }));

      const importBackup = async (buffer, mode = 'merge') => {
        const csrf = extractCsrfToken((await agent.get('/admin')).text);
        return agent
          .post('/admin/import')
          .field('_csrf', csrf)
          .field('mode', mode)
          .attach('backupFile', buffer, 'backup.json');
      };

      beforeAll(async () => {
        logoBytes = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#5b55ea' } })
          .png()
          .toBuffer();
      });

      afterEach(() => {
        writeData('shortcuts.json', []);
      });

      it('exports every site, embedding local logos and keeping remote logo URLs', async () => {
        fs.writeFileSync(path.join(uploadDir, 'export-test.png'), logoBytes);
        writeData('shortcuts.json', [
          seededSite({ id: 'a', name: 'Local logo', imageUrl: '/uploads/export-test.png' }),
          seededSite({
            id: 'b',
            name: 'Remote logo',
            targetUrl: 'https://b.example/',
            imageUrl: 'https://b.example/l.png',
          }),
        ]);

        const res = await agent.get('/admin/export');

        expect(res.status).toBe(200);
        expect(res.headers['content-disposition']).toMatch(
          /attachment; filename="shortcutwall-\d{4}-\d{2}-\d{2}\.json"/,
        );
        const backup = JSON.parse(res.text);
        expect(backup).toMatchObject({ app: 'ShortcutWall', version: 1 });
        const [local, remote] = backup.sites;
        expect(local.imageUrl).toBeNull();
        expect(Buffer.from(local.image.data, 'base64').equals(logoBytes)).toBe(true);
        expect(remote).toMatchObject({ imageUrl: 'https://b.example/l.png', image: null });
        expect(res.text).not.toContain('/uploads/');
        fs.rmSync(path.join(uploadDir, 'export-test.png'), { force: true });
      });

      it('merges a backup: adds new sites with their logos, skips URLs already present', async () => {
        writeData('shortcuts.json', [seededSite({ id: 'kept', targetUrl: 'https://dup.example/' })]);

        const res = await importBackup(
          backupFile([
            { name: 'New', targetUrl: 'https://new.example/', image: { data: logoBytes.toString('base64') } },
            { name: 'Duplicate', targetUrl: 'https://dup.example/' },
          ]),
        );

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/admin?status=imported&count=1');
        const sites = readData('shortcuts.json');
        expect(sites.map((site) => site.name)).toEqual(['Site', 'New']);
        expect(sites[1].imageUrl).toMatch(/^\/uploads\/logo-.+\.png$/);
        expect(fs.existsSync(path.join(uploadDir, path.basename(sites[1].imageUrl)))).toBe(true);
      });

      it('replaces every site in "replace" mode', async () => {
        writeData('shortcuts.json', [seededSite({ id: 'old', name: 'Old' })]);

        const res = await importBackup(backupFile([{ name: 'Fresh', targetUrl: 'https://fresh.example/' }]), 'replace');

        expect(res.headers.location).toBe('/admin?status=imported&count=1');
        expect(readData('shortcuts.json').map((site) => site.name)).toEqual(['Fresh']);
      });

      it('drops an embedded logo that is not a raster image (e.g. SVG)', async () => {
        const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

        await importBackup(
          backupFile([{ name: 'Svg', targetUrl: 'https://svg.example/', image: { data: svg.toString('base64') } }]),
        );

        expect(readData('shortcuts.json')[0].imageUrl).toBe('');
      });

      it('rejects an invalid file or site without importing anything', async () => {
        const notJson = await importBackup(Buffer.from('not json'));
        expect(notJson.status).toBe(400);
        expect(notJson.text).toMatch(/valid ShortcutWall backup/);

        const badSite = await importBackup(
          backupFile([
            { name: 'Good', targetUrl: 'https://good.example/' },
            { name: 'Bad', targetUrl: 'javascript:alert(1)' },
          ]),
        );
        expect(badSite.status).toBe(400);
        expect(badSite.text).toContain('Bad');
        expect(readData('shortcuts.json')).toHaveLength(0);
      });

      it('requires authentication', async () => {
        const res = await request(app).get('/admin/export');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/admin/login');
      });
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
