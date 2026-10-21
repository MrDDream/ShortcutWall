const createApp = require('./src/app');
const { PORT, HOST, IS_PRODUCTION } = require('./src/config');
const logger = require('./src/lib/logger');
const { scheduleOrphanUploadsCleanup } = require('./src/lib/uploadsCleanup');

const app = createApp();

const server = app.listen(PORT, HOST, () => {
  const hostText = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;
  logger.info(`Serveur pret sur http://${hostText}:${PORT}`);
  if (!IS_PRODUCTION) {
    logger.info(`NODE_ENV=${process.env.NODE_ENV || 'development'}`);
  }
  scheduleOrphanUploadsCleanup();
});

// docker stop / Ctrl-C: stop accepting connections and let in-flight requests
// finish (a save in progress, a favicon lookup) before exiting, with a hard
// deadline in case a connection lingers.
function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 8000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
