import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect } from 'vitest';

const configPath = path.resolve(__dirname, '../../src/config.js');

// dotenv reads the .env of the working directory: run from an empty one so the
// developer's own .env never leaks into these checks.
const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shortcutwall-config-'));

// Loads the config in a fresh process with exactly the given environment;
// `print` names a setting to write to stdout.
function loadConfig(env, print = null) {
  const script = print
    ? `console.log(require(${JSON.stringify(configPath)}).${print})`
    : `require(${JSON.stringify(configPath)})`;
  return spawnSync(process.execPath, ['-e', script], {
    cwd: emptyDir,
    env: { PATH: process.env.PATH, DOTENV_CONFIG_QUIET: 'true', ...env },
    encoding: 'utf-8',
  });
}

describe('config', () => {
  it('refuses to start in production with the default password or session secret', () => {
    const defaults = loadConfig({ NODE_ENV: 'production' });
    expect(defaults.status).not.toBe(0);
    expect(defaults.stderr).toMatch(/Refusing to start in production/);

    const defaultSecret = loadConfig({ NODE_ENV: 'production', ADMIN_PASS: 'a-real-password' });
    expect(defaultSecret.status).not.toBe(0);
  });

  it('refuses to start in production with a session secret shorter than 32 characters', () => {
    const shortSecret = loadConfig({
      NODE_ENV: 'production',
      ADMIN_PASS: 'a-real-password',
      SESSION_SECRET: 'short-but-not-default',
    });
    expect(shortSecret.status).not.toBe(0);
    expect(shortSecret.stderr).toMatch(/shorter than 32 characters/);
  });

  it('starts in production with custom credentials, and outside production with defaults', () => {
    expect(
      loadConfig({ NODE_ENV: 'production', ADMIN_PASS: 'a-real-password', SESSION_SECRET: 'x'.repeat(32) }).status,
    ).toBe(0);
    expect(loadConfig({ NODE_ENV: 'development' }).status).toBe(0);
  });

  it('allows private networks unless ALLOW_PRIVATE_NETWORKS is false', () => {
    expect(loadConfig({}, 'ALLOW_PRIVATE_NETWORKS').stdout.trim()).toBe('true');
    expect(loadConfig({ ALLOW_PRIVATE_NETWORKS: 'false' }, 'ALLOW_PRIVATE_NETWORKS').stdout.trim()).toBe('false');
  });
});
