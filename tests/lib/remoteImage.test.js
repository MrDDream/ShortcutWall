import { describe, it, expect } from 'vitest';

import { importRemoteImage } from '../../src/lib/remoteImage.js';

describe('remoteImage.importRemoteImage', () => {
  it('returns null for invalid or non-http(s) URLs', async () => {
    expect(await importRemoteImage('not a url')).toBeNull();
    expect(await importRemoteImage('file:///etc/passwd')).toBeNull();
    expect(await importRemoteImage('/uploads/logo.png')).toBeNull();
  });

  it('never fetches from a non-public host (SSRF guard)', async () => {
    expect(await importRemoteImage('http://127.0.0.1/logo.png')).toBeNull();
    expect(await importRemoteImage('http://169.254.169.254/latest/meta-data')).toBeNull();
  });
});
