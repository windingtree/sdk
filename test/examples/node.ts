import 'dotenv/config';
import { EventHandler } from '@libp2p/interfaces/events';
import { DateTime } from 'luxon';
import { Hash, Hex, zeroAddress } from 'viem';
import { hardhat, polygonZkEvmTestnet } from 'viem/chains';
import { randomSalt } from '@windingtree/contracts';
import {
  contractsConfig,
  OfferOptions,
  RequestQuery,
  serverAddress,
  stableCoins,
} from '../../examples/shared/index.js';
import {
  CenterSub,
  JobHandler,
  OfferData,
  DealStatus,
  ProtocolContracts,
  noncePeriod,
} from '../../src/index.js';
import { nowSec, parseSeconds } from '../../src/utils/time.js';
import {
  NodeOptions,
  RequestEvent,
  Node,
  createNode,
  NodeRequestManager,
} from '../../src/node/index.js';
import { createLogger } from '../../src/utils/logger.js';
import { OPEN } from '@libp2p/interface-connection/status';
import { multiaddr } from '@multiformats/multiaddr';
import { peerIdFromString } from '@libp2p/peer-id';
import { PeerId } from '@libp2p/interface-peer-id';
import { mnemonicToAccount } from 'viem/accounts';
import { generateMnemonic } from '../../src/utils/wallet.js';
import { supplierId as spId } from '../../src/utils/uid.js';

const logger = createLogger('NodeMain');

/**
 * This is interface of object that you want to pass to the job handler as options
 */
interface DealHandlerOptions {
  contracts: ProtocolContracts;
}

export class NodeExample {
  private node: Node<RequestQuery, OfferOptions>;

  /**
   * Chain config
   */
  private chain =
    process.env.LOCAL_NODE === 'true' ? hardhat : polygonZkEvmTestnet;

  /**
   * The supplier signer credentials
   */
  private signerMnemonic = process.env.EXAMPLE_ENTITY_SIGNER_MNEMONIC;
  private signerPk = process.env.EXAMPLE_ENTITY_SIGNER_PK as Hex;

  /**
   * Supplier Id is hashed combination of a random salt string and
   * an address of the supplier owner account address.
   * Supplier must register his entity in the EntitiesRegistry
   */
  private supplierId = process.env.EXAMPLE_ENTITY_ID as Hash;
  private serverPeerId: PeerId;

  constructor() {
    const mnemonic = generateMnemonic();
    const signer = mnemonicToAccount(mnemonic);
    const supplierId = spId(randomSalt(), signer.address);

    const options: NodeOptions = {
      topics: ['hello'],
      chain: this.chain,
      contracts: contractsConfig,
      serverAddress,
      supplierId: supplierId,
      signerSeedPhrase: mnemonic,
      signerPk: this.signerPk,
    };

    this.node = createNode<RequestQuery, OfferOptions>(options);

    const serverMultiaddr = multiaddr(serverAddress);
    const serverPeerIdString = serverMultiaddr.getPeerId();

    if (!serverPeerIdString) {
      throw new Error('Unable to extract peer id from the server address');
    }

    this.serverPeerId = peerIdFromString(serverPeerIdString);
  }

  private createJobHandler =
    <JobData = unknown, HandlerOptions = unknown>(
      handler: JobHandler<JobData, HandlerOptions>,
    ) =>
    (options: HandlerOptions = {} as HandlerOptions) =>
    (data: JobData) =>
      handler(data, options);

  /**
   * This handler looking up for a deal
   */
  private dealHandler = this.createJobHandler<
    OfferData<RequestQuery, OfferOptions>,
    DealHandlerOptions
  >(async (offer, options) => {
    if (!offer || !options) {
      throw new Error('Invalid job execution configuration');
    }

    const { contracts } = options;

    if (!contracts) {
      throw new Error(
        'Contracts manager must be provided to job handler config',
      );
    }

    logger.trace(`Checking for a deal. Offer #${offer.id}`);

    // Check for a deal
    const [, , , buyer, , , status] = await contracts.getDeal(offer);

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
            `Offer #${offer.payload.id} ${
              txSubj ?? 'claim'
            } tx hash: ${txHash}`,
          );
        },
      );

      return false; // Returning true means that the job must be stopped
    }

    return true; // Job continuing
  });

  /**
   * This handler creates offer then publishes it and creates a job for deal handling
   */
  private createRequestsHandler =
    (
      node: Node<RequestQuery, OfferOptions>,
    ): EventHandler<CustomEvent<RequestEvent<RequestQuery>>> =>
    ({ detail }) => {
      const handler = async () => {
        logger.trace(`📨 Request on topic #${detail.topic}:`, detail.data);

        await node.makeOffer({
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
      };

      handler().catch(logger.error);
    };
  /**
   * Starts the suppliers node
   *
   * @returns {Promise<void>}
   */
  public start = async (): Promise<Node<RequestQuery, OfferOptions>> => {
    /** Handles UFOs */
    process.once('unhandledRejection', (error) => {
      logger.trace('🛸 Unhandled rejection', error);
      process.exit(1);
    });

    this.node.addEventListener('start', () => {
      logger.trace('🚀 Node started at', new Date().toISOString());
    });

    this.node.addEventListener('connected', () => {
      logger.trace('🔗 Node connected to server at:', new Date().toISOString());
    });

    this.node.addEventListener('stop', () => {
      logger.trace('👋 Node stopped at:', new Date().toISOString());
    });

    const requestManager = new NodeRequestManager<RequestQuery>({
      noncePeriod: Number(parseSeconds(noncePeriod)),
    });

    requestManager.addEventListener(
      'request',
      this.createRequestsHandler(this.node),
    );

    this.node.addEventListener('heartbeat', () => {
      requestManager.prune();
    });

    this.node.addEventListener('message', (e) => {
      const { topic, data } = e.detail;
      // here you are able to pre-validate arrived messages
      requestManager.add(topic, data);
    });

    /**
     * Graceful Shutdown handler
     */
    const shutdown = () => {
      const stopHandler = async () => {
        await this.node.stop();
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

    await this.node.start();

    return this.node;
  };

  get connected(): boolean {
    return (
      !!this.node.libp2p &&
      (this.node.libp2p.services.pubsub as CenterSub).started &&
      this.node.libp2p.getPeers().length > 0 &&
      this.node.libp2p.getConnections(this.serverPeerId)[0]?.stat.status ===
        OPEN
    );
  }

  public stop = async (): Promise<void> => {
    await this.node.stop();
  };
}
