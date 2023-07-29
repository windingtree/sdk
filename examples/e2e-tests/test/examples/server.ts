import peerKey from './peerKey.json';
import { createLogger } from '@windingtree/sdk-logger';
import { memoryStorage } from '@windingtree/sdk-storage';
import {
  CoordinationServer,
  createServer,
  ServerOptions,
} from '@windingtree/sdk-server';

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
    try {
      return !!this.server.multiaddrs;
    } catch (e) {
      return false;
    }
  }

  stop = async () => {
    await this.server.stop();
  };
}
