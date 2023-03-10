import { createServer, ServerOptions } from '../../src/index.js';
import { memoryStorage } from '../../src/storage/index.js';
import peerKey from '../../test/peerKey.json';

process.once('unhandledRejection', (error) => {
  console.log('🛸 Unhandled rejection', error);
  process.exit(1);
});

const main = async (): Promise<void> => {
  const options: ServerOptions = {
    port: 33333,
    peerKey,
  };
  const server = createServer(options, memoryStorage.init());

  server.addEventListener('start', () => {
    console.log('🚀 Server started at', new Date().toISOString());
  });

  server.addEventListener('stop', () => {
    console.log('👋 Server stopped at:', new Date().toISOString());
  });

  // Graceful Shutdown handler
  const shutdown = () => {
    const stopHandler = async () => {
      await server.stop();
    };
    stopHandler()
      .catch(console.log)
      .finally(() => process.exit(0));
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  await server.start();
};

export default main().catch((error) => {
  console.log('🚨 Internal application error', error);
  process.exit(1);
});
