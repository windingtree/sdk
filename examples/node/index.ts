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
} from '../shared/types.js';
import {
  createNode,
  Node,
  NodeOptions,
  Queue,
  OfferData,
  createJobHandler,
} from '../../src/index.js';
import { noncePeriod } from '../../src/constants.js';
import { memoryStorage } from '../../src/storage/index.js';
import { nowSec, parseSeconds } from '../../src/utils/time.js';
import { supplierId as generateSupplierId, randomSalt, simpleUid } from '../../src/utils/uid.js';
import { generateMnemonic, deriveAccount } from '../../src/utils/wallet.js';
import { RequestEvent } from '../../src/node/requestManager.js';
import { createLogger } from '../../src/utils/logger.js';

const logger = createLogger('NodeMain');

/**
 * These are randomly generated wallets, just for demonstration.
 * In production, you have to provide (and handle) them in a secure way
 */
const supplierMnemonic = generateMnemonic();
const signerMnemonic = generateMnemonic();

/**
 * Supplier Id is hashed combination of a random salt string and
 * an address of the supplier owner account address.
 */
const salt = randomSalt();
const supplierId = generateSupplierId(salt, deriveAccount(supplierMnemonic, 0));

/** Handles UFOs */
process.once('unhandledRejection', (error) => {
  logger.trace('🛸 Unhandled rejection', error);
  process.exit(1);
});

/**
 * This is interface of object that you want to pass to the job handler as options
 */
interface DealHandlerOptions {
  node: Node<RequestQuery, OfferOptions>;
}

/**
 * This handler looking up for a deal
 */
const dealHandler = createJobHandler<OfferData<RequestQuery, OfferOptions>, DealHandlerOptions>(
  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  async ({ name, id, data: offer }, options) => {
    logger.trace(`Job "${name}" #${id} Checking for a deal. Offer #${offer.id}`);
    // const { node } = options;

    // Makes request to the smart contract, checks for a deal
    // If the deal is found - check for double booking in the availability system
    // If double booking detected - rejects (and refunds) the deal
    // If not detected - claims the deal
  },
);

/**
 * This handler creates offer then publishes it and creates a job for deal handling
 */
const createRequestsHandler =
  (
    node: Node<RequestQuery, OfferOptions>,
    queue: Queue,
  ): EventHandler<CustomEvent<RequestEvent<RequestQuery>>> =>
  ({ detail }) => {
    const handler = async () => {
      logger.trace(`📨 Request on topic #${detail.topic}:`, detail.data);

      const offer = await node.buildOffer({
        /** Offer expiration time */
        expire: '30s',
        /** Copy of request */
        request: detail.data,

        /** Random options data. Just for testing */
        options: {
          date: DateTime.now().toISODate(),
          buongiorno: Math.random() < 0.5,
          buonasera: Math.random() < 0.5,
        },

        /**
         * Dummy payment option.
         * In production these options managed by supplier
         */
        payment: [
          {
            id: simpleUid(),
            price: '1',
            asset: ZeroAddress,
          },
        ],
        /** Cancellation options */
        cancel: [
          {
            time: nowSec() + 500,
            penalty: 100,
          },
        ],
        /** Check-in time */
        checkIn: nowSec() + 1000,
      });

      queue.addEventListener('expired', ({ detail: job }) => {
        logger.trace(`Job #${job.id} is expired`);
      });

      /**
       * On every published offer we expecting a deal.
       * So, we add a job for detection of deals
       */
      queue.addJob('deal', offer, {
        expire: offer.expire,
        every: 5000, // 5 sec
      });
    };

    handler().catch(logger.error);
  };

/**
 * Starts the suppliers node
 *
 * @returns {Promise<void>}
 */
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

  queue.addJobHandler('deal', dealHandler({ node }));

  node.addEventListener('start', () => {
    logger.trace('🚀 Node started at', new Date().toISOString());
  });

  node.addEventListener('connected', () => {
    logger.trace('🔗 Node connected to server at:', new Date().toISOString());
  });

  node.addEventListener('stop', () => {
    logger.trace('👋 Node stopped at:', new Date().toISOString());
  });

  node.addEventListener('request', createRequestsHandler(node, queue));

  /**
   * Graceful Shutdown handler
   */
  const shutdown = () => {
    const stopHandler = async () => {
      await node.stop();
    };
    stopHandler()
      .catch((error) => {
        logger.trace(error);
        process.exit(1);
      })
      .finally(() => process.exit(0));
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  await node.start();
};

/** Let's go */
export default main().catch((error) => {
  logger.trace('🚨 Internal application error', error);
  process.exit(1);
});
