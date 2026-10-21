const pino = require('pino');

const { IS_PRODUCTION } = require('../config');

// Never written to the logs: session cookies, credentials and API keys sent by
// other tools hitting the port. Anyone who can read the logs (a log viewer
// such as Dozzle, `docker logs`…) could otherwise reuse an admin session.
const REDACTED_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["proxy-authorization"]',
  'req.headers["x-api-key"]',
  'req.headers["x-api-id"]',
  'res.headers["set-cookie"]',
];

function createLogger(destination) {
  return pino(
    {
      level: process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug'),
      redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
      transport:
        IS_PRODUCTION || destination
          ? undefined
          : {
              target: 'pino-pretty',
              options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
            },
    },
    destination,
  );
}

module.exports = createLogger();
module.exports.createLogger = createLogger;
