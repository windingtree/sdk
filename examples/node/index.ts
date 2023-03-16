import {
  RequestQuerySchema,
  RequestQuery,
  OfferOptionsSchema,
  OfferOptions,
  contractConfig,
  serverAddress,
} from '../common/types.js';
import { createNode, NodeOptions } from '../../src/index.js';
import { parseSeconds } from '../../src/utils/time.js';
import { noncePeriod } from '../../src/constants.js';

process.once('unhandledRejection', (error) => {
  console.log('🛸 Unhandled rejection', error);
  process.exit(1);
});

const main = async (): Promise<void> => {
  const options: NodeOptions<RequestQuery, OfferOptions> = {
    querySchema: RequestQuerySchema,
    offerOptionsSchema: OfferOptionsSchema,
    topics: ['hello'],
    contractConfig,
    serverAddress,
    noncePeriod: parseSeconds(noncePeriod),
  };
  const node = createNode(options);

  node.addEventListener('start', () => {
    console.log('🚀 Node started at', new Date().toISOString());
  });

  node.addEventListener('connected', () => {
    console.log('🔗 Node connected to server at:', new Date().toISOString());
  });

  node.addEventListener('stop', () => {
    console.log('👋 Node stopped at:', new Date().toISOString());
  });

  node.addEventListener('request', ({ detail }) => {
    console.log(`📨 Request on topic #${detail.topic}:`, detail.data);
  });

  // Graceful Shutdown handler
  const shutdown = () => {
    const stopHandler = async () => {
      await node.stop();
    };
    stopHandler()
      .catch(console.log)
      .finally(() => process.exit(0));
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  await node.start();
};

export default main().catch((error) => {
  console.log('🚨 Internal application error', error);
  process.exit(1);
});
