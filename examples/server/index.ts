import { createServer, ServerOptions } from '../../src/index.js';
import { memoryStorage } from '../../src/storage/index.js';
import peerKey from '../../test/peerKey.json';
import { createLogger } from '../../src/utils/logger.js';

const logger = createLogger('ServerMain');

/** Handles UFOs */
process.once('unhandledRejection', (error) => {
  logger.error('🛸 Unhandled rejection', error);
  process.exit(1);
});

/**
 * Starts the server
 *
 * @returns {Promise<void>}
 */
const main = async (): Promise<void> => {
  const options: ServerOptions = {
    port: 33333,
    peerKey,
    /**
     * This example uses MemoryStorage
     * but in production it is recommended to use Redis
     * */
    messagesStorageInit: memoryStorage.createInitializer(),
  };
  const server = createServer(options);

  server.addEventListener('start', () => {
    logger.trace('🚀 Server started at', new Date().toISOString());
  });

  server.addEventListener('stop', () => {
    logger.trace('👋 Server stopped at:', new Date().toISOString());
  });

  /** Graceful Shutdown handler */
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

/** Let's go */
export default main().catch((error) => {
  logger.error('🚨 Internal application error', error);
  process.exit(1);
});
