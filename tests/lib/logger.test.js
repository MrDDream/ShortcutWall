import { Writable } from 'stream';
import { describe, it, expect } from 'vitest';

import loggerModule from '../../src/lib/logger.js';

const { createLogger } = loggerModule;

function captureLines() {
  const lines = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()));
      callback();
    },
  });
  return { lines, logger: createLogger(stream) };
}

describe('logger', () => {
  it('never writes session cookies, credentials or API keys', () => {
    const { lines, logger } = captureLines();

    logger.info(
      {
        req: {
          method: 'GET',
          url: '/admin',
          headers: {
            host: 'wall.local',
            cookie: 'connect.sid=s%3Asecret-session',
            authorization: 'Basic c2VjcmV0',
            'x-api-key': 'secret-key',
          },
        },
        res: { statusCode: 302, headers: { 'set-cookie': ['connect.sid=s%3Anew-secret'] } },
      },
      'request completed',
    );

    const [line] = lines;
    expect(line.req.headers).toMatchObject({
      host: 'wall.local',
      cookie: '[redacted]',
      authorization: '[redacted]',
      'x-api-key': '[redacted]',
    });
    expect(line.res.headers['set-cookie']).toBe('[redacted]');
    expect(JSON.stringify(line)).not.toMatch(/secret/);
  });
});
