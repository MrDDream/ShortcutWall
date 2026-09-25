const createApp = require('./src/app');
const { PORT, HOST, IS_PRODUCTION } = require('./src/config');
const logger = require('./src/lib/logger');

const app = createApp();

app.listen(PORT, HOST, () => {
  const hostText = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;
  logger.info(`Serveur pret sur http://${hostText}:${PORT}`);
  if (!IS_PRODUCTION) {
    logger.info(`NODE_ENV=${process.env.NODE_ENV || 'development'}`);
  }
});
