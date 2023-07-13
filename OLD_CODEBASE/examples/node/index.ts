import 'dotenv/config';
import { EventHandler } from '@libp2p/interfaces/events';
import { DateTime } from 'luxon';
import { Address, Hash, Hex, zeroAddress } from 'viem';
import { hardhat, polygonZkEvmTestnet } from 'viem/chains';
import { randomSalt } from '@windingtree/contracts';
import {
  RequestQuery,
  OfferOptions,
  contractsConfig,
  stableCoins,
  serverAddress,
} from '../shared/index.js';
import {
  DealsDb,
  Node,
  NodeOptions,
  NodeRequestManager,
  createNode,
} from '../../src/node/index.js';
import { Queue, JobHandler } from '../../src/shared/queue.js';
import { OfferData } from '../../src/shared/types.js';
import { DealStatus, ProtocolContracts } from '../../src/shared/contracts.js';
import { noncePeriod } from '../../src/constants.js';
import { memoryStorage } from '../../src/storage/index.js';
import { nowSec, parseSeconds } from '../../src/utils/time.js';
import { RequestEvent } from '../../src/node/requestManager.js';
import { appRouter, NodeApiServer } from '../../src/node/index.js';
import { createLogger } from '../../../packages/logger/src/index.js';

const logger = createLogger('NodeMain');

/**
 * Chain config
 */
const chain = process.env.LOCAL_NODE === 'true' ? hardhat : polygonZkEvmTestnet;

/**
 * The supplier signer credentials
 */
const signerMnemonic = process.env.EXAMPLE_ENTITY_SIGNER_MNEMONIC;
const signerPk = process.env.EXAMPLE_ENTITY_SIGNER_PK as Hex;

if (!signerMnemonic && !signerPk) {
  throw new Error(
    'Either signerMnemonic or signerPk must be provided with env',
  );
}

/**
 * Supplier Id is hashed combination of a random salt string and
 * an address of the supplier owner account address.
 * Supplier must register his entity in the EntitiesRegistry
 */
const supplierId = process.env.EXAMPLE_ENTITY_ID as Hash;

if (!supplierId) {
  throw new Error('Entity Id must be provided with EXAMPLE_ENTITY_ID env');
}

/**
 * The Ethereum account address of the entity owner (supplier)
 */
const entityOwnerAddress = process.env.EXAMPLE_ENTITY_OWNER_ADDRESS as Address;

if (!entityOwnerAddress) {
  throw new Error(
    'Entity owner address must be provided with EXAMPLE_ENTITY_OWNER_ADDRESS env',
  );
}

/** Handles UFOs */
process.once('unhandledRejection', (error) => {
  logger.trace('🛸 Unhandled rejection', error);
  process.exit(1);
});

const createJobHandler =
  <JobData = unknown, HandlerOptions = unknown>(
    handler: JobHandler<JobData, HandlerOptions>,
  ) =>
  (options: HandlerOptions = {} as HandlerOptions) =>
  (data: JobData) =>
    handler(data, options);

/**
 * This is interface of object that you want to pass to the job handler as options
 */
interface DealHandlerOptions {
  contracts: ProtocolContracts;
  dealsDb: DealsDb;
}

/**
 * This handler looking up for a deal
 */
const dealHandler = createJobHandler<
  OfferData<RequestQuery, OfferOptions>,
  DealHandlerOptions
>(async (offer, options) => {
  if (!offer || !options) {
    throw new Error('Invalid job execution configuration');
  }

  const { contracts, dealsDb } = options;

  if (!contracts) {
    throw new Error('Contracts manager must be provided to job handler config');
  }

  logger.trace(`Checking for a deal. Offer #${offer.id}`);

  // Check for a deal
  const [created, offerPayload, retailerId, buyer, price, asset, status] =
    await contracts.getDeal(offer);

  // Deal must be exists and not cancelled
  if (buyer !== zeroAddress && status === DealStatus.Created) {
    // check for double booking in the availability system
    // If double booking detected - rejects (and refunds) the deal

    // If not detected - claims the deal
    await contracts.claimDeal(
      offer,
      undefined,
      (txHash: string, txSubj?: string) => {
        logger.trace(
          `Offer #${offer.payload.id} ${txSubj ?? 'claim'} tx hash: ${txHash}`,
        );
      },
    );

    await dealsDb.set({
      chainId: Number(offerPayload.chainId),
      created,
      offer,
      retailerId,
      buyer,
      price,
      asset,
      status: DealStatus.Claimed,
    });

    return false; // Returning false means that the job must be stopped
  }

  return true; // Job continuing
});

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

      const offer = await node.makeOffer({
        /** Offer expiration time */
        expire: '15m',
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
            id: randomSalt(),
            price: BigInt('1000000000000000'), // 0.001
            asset: stableCoins.stable18permit,
          },
          {
            id: randomSalt(),
            price: BigInt('1200000000000000'), // 0.0012
            asset: stableCoins.stable18,
          },
        ],
        /** Cancellation options */
        cancel: [
          {
            time: BigInt(nowSec() + 500),
            penalty: BigInt(100),
          },
        ],
        /** Check-in time */
        checkIn: BigInt(nowSec() + 1000),
        checkOut: BigInt(nowSec() + 2000),
      });

      queue.addEventListener('status', ({ detail: job }) => {
        logger.trace(`Job #${job.id} status changed`, job);
      });

      /**
       * On every published offer we expecting a deal.
       * So, we add a job for detection of deals
       */
      queue.add({
        handlerName: 'deal',
        data: offer,
        isRecurrent: true,
        recurrenceInterval: 5000,
        expire: Number(offer.expire),
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
  const options: NodeOptions = {
    topics: ['hello'],
    chain,
    contracts: contractsConfig,
    serverAddress,
    supplierId,
    signerSeedPhrase: signerMnemonic,
    signerPk: signerPk,
  };
  const node = createNode<RequestQuery, OfferOptions>(options);

  node.addEventListener('start', () => {
    logger.trace('🚀 Node started at', new Date().toISOString());
  });

  node.addEventListener('connected', () => {
    logger.trace('🔗 Node connected to server at:', new Date().toISOString());
  });

  node.addEventListener('stop', () => {
    logger.trace('👋 Node stopped at:', new Date().toISOString());
  });

  const contractsManager = new ProtocolContracts({
    contracts: contractsConfig,
    publicClient: node.publicClient,
    walletClient: node.walletClient,
  });

  const queueStorage = await memoryStorage.createInitializer({
    scope: 'queue',
  })();
  const usersStorage = await memoryStorage.createInitializer({
    scope: 'users',
  })();
  const dealsStorage = await memoryStorage.createInitializer({
    scope: 'deals',
  })();

  const apiServer = new NodeApiServer({
    usersStorage,
    dealsStorage,
    prefix: 'test',
    port: 3456,
    secret: 'secret',
    ownerAccount: entityOwnerAddress,
    protocolContracts: contractsManager,
  });

  apiServer.start(appRouter);

  const queue = new Queue({
    storage: queueStorage,
    idsKeyName: 'jobsIds',
    concurrencyLimit: 3,
  });

  const requestManager = new NodeRequestManager<RequestQuery>({
    noncePeriod: Number(parseSeconds(noncePeriod)),
  });

  requestManager.addEventListener(
    'request',
    createRequestsHandler(node, queue),
  );

  node.addEventListener('heartbeat', () => {
    requestManager.prune();
  });

  node.addEventListener('message', (e) => {
    const { topic, data } = e.detail;
    // here you are able to pre-validate arrived messages
    requestManager.add(topic, data);
  });

  queue.registerHandler(
    'deal',
    dealHandler({
      contracts: contractsManager,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      dealsDb: apiServer.deals!,
    }),
  );

  /**
   * Graceful Shutdown handler
   */
  const shutdown = () => {
    const stopHandler = async () => {
      await apiServer.stop();
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
