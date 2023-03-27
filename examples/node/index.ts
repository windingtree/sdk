import { EventHandler } from '@libp2p/interfaces/events';
import { ZeroAddress } from 'ethers';
import { DateTime } from 'luxon';
import {
  RequestQuerySchema,
  RequestQuery,
  OfferOptionsSchema,
  OfferOptions,
  contractConfig,
  serverAddress,
} from '../common/types.js';
import { createNode, Node, NodeOptions, Queue, JobHandler, OfferData } from '../../src/index.js';
import { noncePeriod } from '../../src/constants.js';
import { memoryStorage } from '../../src/storage/index.js';
import { nowSec, parseSeconds } from '../../src/utils/time.js';
import { supplierId as generateSupplierId, randomSalt, simpleUid } from '../../src/utils/uid.js';
import { generateMnemonic, deriveAccount } from '../../src/utils/wallet.js';
import { RequestEvent } from '../../src/node/requestManager.js';
import { createLogger } from '../../src/utils/logger.js';

const logger = createLogger('NodeInstance');

const supplierMnemonic = generateMnemonic();
const signerMnemonic = generateMnemonic();

const salt = randomSalt();
const supplierId = generateSupplierId(salt, deriveAccount(supplierMnemonic, 0));

process.once('unhandledRejection', (error) => {
  console.log('🛸 Unhandled rejection', error);
  process.exit(1);
});

// This handler looking up for a deal
const createDealHandler =
  (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    node: Node<RequestQuery, OfferOptions>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ): JobHandler<OfferData<RequestQuery, OfferOptions>> =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async ({ name, id, data: offer }) => {
    logger.trace(`Job "${name}" #${id} Checking for a deal. Offer #${offer.id}`);
    // Makes request to the smart contract, checks for a deal
    // If the deal is found - check for double booking in the availability system
    // If double booking detected - rejects (and refunds) the deal
    // If not detected - claims the deal
  };

// This handler creates offer then publishes it and creates a job for deal handling
const createRequestsHandler =
  (
    node: Node<RequestQuery, OfferOptions>,
    queue: Queue,
  ): EventHandler<CustomEvent<RequestEvent<RequestQuery>>> =>
  ({ detail }) => {
    const handler = async () => {
      console.log(`📨 Request on topic #${detail.topic}:`, detail.data);

      const offer = await node.buildOffer({
        expire: '30s',
        request: detail.data,
        options: {
          date: DateTime.now().toISODate(),
          buongiorno: Math.random() < 0.5,
          buonasera: Math.random() < 0.5,
        },
        payment: [
          {
            id: simpleUid(),
            price: '1',
            asset: ZeroAddress,
          },
        ],
        cancel: [
          {
            time: nowSec() + 500,
            penalty: 100,
          },
        ],
        checkIn: nowSec() + 1000,
      });

      queue.addEventListener('expired', ({ detail: job }) => {
        logger.trace(`Job #${job.id} is expired`);
      });

      queue.addJob('deal', offer, {
        expire: offer.expire,
        every: 5000, // 5 sec
      });
    };
    handler().catch(logger.error);
  };

const main = async (): Promise<void> => {
  const storage = await memoryStorage.init()();
  const queue = new Queue({
    storage,
    hashKey: 'jobs',
    concurrentJobsNumber: 3,
  });

  const options: NodeOptions<RequestQuery, OfferOptions> = {
    querySchema: RequestQuerySchema,
    offerOptionsSchema: OfferOptionsSchema,
    topics: ['hello'],
    contractConfig,
    serverAddress,
    noncePeriod: parseSeconds(noncePeriod),
    supplierId,
    signerSeedPhrase: signerMnemonic,
  };
  const node = createNode(options);

  queue.addJobHandler('deal', createDealHandler(node));

  node.addEventListener('start', () => {
    console.log('🚀 Node started at', new Date().toISOString());
  });

  node.addEventListener('connected', () => {
    console.log('🔗 Node connected to server at:', new Date().toISOString());
  });

  node.addEventListener('stop', () => {
    console.log('👋 Node stopped at:', new Date().toISOString());
  });

  node.addEventListener('request', createRequestsHandler(node, queue));

  // Graceful Shutdown handler
  const shutdown = () => {
    const stopHandler = async () => {
      await node.stop();
    };
    stopHandler()
      .catch((error) => {
        console.log(error);
        process.exit(1);
      })
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
