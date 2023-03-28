import { createServer, ServerOptions } from '../../src/index.js';
import { memoryStorage } from '../../src/storage/index.js';
import peerKey from '../../test/peerKey.json';
import { createLogger } from '../../src/utils/logger.js';

const logger = createLogger('ServerMain');

process.once('unhandledRejection', (error) => {
  logger.error('🛸 Unhandled rejection', error);
  process.exit(1);
});

const main = async (): Promise<void> => {
  const options: ServerOptions = {
    port: 33333,
    peerKey,
  };
  const server = createServer(options, memoryStorage.init());

  server.addEventListener('start', () => {
    logger.trace('🚀 Server started at', new Date().toISOString());
  });

  server.addEventListener('stop', () => {
    logger.trace('👋 Server stopped at:', new Date().toISOString());
  });

  // Graceful Shutdown handler
  const shutdown = () => {
    const stopHandler = async () => {
      await server.stop();
    };
    stopHandler()
      .catch(logger.error)
      .finally(() => process.exit(0));
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  await server.start();
};

export default main().catch((error) => {
  logger.error('🚨 Internal application error', error);
  process.exit(1);
});
