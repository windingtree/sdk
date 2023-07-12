import { ServerOptions } from '../../src/index.js';
import peerKey from '../peerKey.json';
import { memoryStorage } from '../../src/storage/index.js';
import { createLogger } from '../../src/utils/index.js';
import { CoordinationServer, createServer } from '../../src/server/index.js';

const logger = createLogger('ServerExample');

export class ServerExample {
  private server: CoordinationServer;

  constructor() {
    const options: ServerOptions = {
      port: 33333,
      peerKey,
      /**
       * This example uses MemoryStorage
       * but in production it is recommended to use Redis
       * */
      messagesStorageInit: memoryStorage.createInitializer(),
    };
    this.server = createServer(options);
  }

  public start = async () => {
    this.server.addEventListener('start', () => {
      logger.trace('🚀 Server started at', new Date().toISOString());
    });

    this.server.addEventListener('stop', () => {
      logger.trace('👋 Server stopped at:', new Date().toISOString());
    });

    /** Graceful Shutdown handler */
    const shutdown = () => {
      const stopHandler = async () => {
        await this.server.stop();
      };
      stopHandler()
        .catch(logger.error)
        .finally(() => process.exit(0));
    };

    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
    await this.server.start();

    return true;
  };

  get connected() {
    return !!this.server.multiaddrs;
  }

  stop = async () => {
    await this.server.stop();
  };
}
