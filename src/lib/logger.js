const pino = require('pino');

const { IS_PRODUCTION } = require('../config');

const logger = pino({
  level: process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug'),
  transport: IS_PRODUCTION
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
});

module.exports = logger;
