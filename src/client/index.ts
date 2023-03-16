import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import { createLibp2p, Libp2pOptions, Libp2p } from 'libp2p';
import { noise } from '@chainsafe/libp2p-noise';
import { mplex } from '@libp2p/mplex';
import { webSockets } from '@libp2p/websockets';
import { all } from '@libp2p/websockets/filters';
import { multiaddr, Multiaddr } from '@multiformats/multiaddr';
import { peerIdFromString } from '@libp2p/peer-id';
import { PeerId } from '@libp2p/interface-peer-id';
import { OPEN } from '@libp2p/interface-connection/status';
import { AbstractProvider } from 'ethers';
import { z } from 'zod';
import { centerSub, CenterSub } from '../shared/pubsub.js';
import {
  createOfferDataSchema,
  GenericOfferOptions,
  GenericQuery,
  OfferData,
  RequestData,
} from '../shared/messages.js';
import { ClientOptions, createClientOptionsSchema } from '../shared/options.js';
import { Request, RawRequest } from '../shared/request.js';
import { RequestsRegistry } from './requestsRegistry.js';
import { decodeText } from '../utils/text.js';
import { ContractConfig } from '../utils/contract.js';
import { StorageInitializer } from '../storage/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Client');

export interface ClientEvents<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> {
  /**
   * @example
   *
   * ```js
   * client.addEventListener('start', () => {
   *    // ... started
   * })
   * ```
   */
  start: CustomEvent<void>;

  /**
   * @example
   *
   * ```js
   * client.addEventListener('stop', () => {
   *    // ... stopped
   * })
   * ```
   */
  stop: CustomEvent<void>;

  /**
   * @example
   *
   * ```js
   * client.addEventListener('heartbeat', () => {
   *    // ... tick
   * })
   * ```
   */
  heartbeat: CustomEvent<void>;

  /**
   * @example
   *
   * ```js
   * client.addEventListener('connected', () => {
   *    // ... connected
   * })
   * ```
   */
  connected: CustomEvent<void>;

  /**
   * @example
   *
   * ```js
   * client.addEventListener('disconnected', () => {
   *    // ... disconnected
   * })
   * ```
   */
  disconnected: CustomEvent<void>;

  /**
   * @example
   *
   * ```js
   * request.addEventListener('requests', () => {
   *    // ... registry updated
   * })
   * ```
   */
  requests: CustomEvent<Required<Request<CustomRequestQuery, CustomOfferOptions>>[]>;
}

export class Client<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> extends EventEmitter<ClientEvents<CustomRequestQuery, CustomOfferOptions>> {
  libp2p?: Libp2p;
  serverMultiaddr: Multiaddr;
  serverPeerId: PeerId;
  querySchema: z.ZodType<CustomRequestQuery>;
  offerOptionsSchema: z.ZodType<CustomOfferOptions>;
  contractConfig: ContractConfig;
  provider?: AbstractProvider;
  private libp2pInit: Libp2pOptions;
  private requestsRegistry?: RequestsRegistry<CustomRequestQuery, CustomOfferOptions>;
  private storageInitializer: StorageInitializer;

  constructor(
    options: ClientOptions<CustomRequestQuery, CustomOfferOptions>,
    storageInitializer: StorageInitializer,
  ) {
    super();

    options = createClientOptionsSchema<CustomRequestQuery, CustomOfferOptions>().parse(options);

    this.querySchema = options.querySchema;
    this.offerOptionsSchema = options.offerOptionsSchema;
    this.contractConfig = options.contractConfig;
    this.libp2pInit = (options.libp2p ?? {}) as Libp2pOptions;
    this.provider = options.provider;
    this.serverMultiaddr = multiaddr(options.serverAddress);
    const serverPeerIdString = this.serverMultiaddr.getPeerId();

    if (!serverPeerIdString) {
      throw new Error('Unable to extract peer id from the server address');
    }

    this.serverPeerId = peerIdFromString(serverPeerIdString);
    this.storageInitializer = storageInitializer;
  }

  get connected(): boolean {
    return (
      !!this.libp2p &&
      (this.libp2p.pubsub as CenterSub).started &&
      this.libp2p.getPeers().length > 0 &&
      this.libp2p.getConnections(this.serverPeerId)[0]?.stat.status === OPEN
    );
  }

  async start(): Promise<void> {
    const config: Libp2pOptions = {
      transports: [webSockets({ filter: all })],
      streamMuxers: [mplex()],
      connectionEncryption: [noise()],
      pubsub: centerSub({
        isClient: true,
        directPeers: [
          {
            id: this.serverPeerId,
            addrs: [this.serverMultiaddr],
          },
        ],
      }),
      ...this.libp2pInit,
    };
    this.libp2p = await createLibp2p(config);

    (this.libp2p.pubsub as CenterSub).addEventListener('gossipsub:heartbeat', () => {
      this.dispatchEvent(new CustomEvent<void>('heartbeat'));
    });

    this.libp2p.addEventListener('peer:connect', ({ detail }) => {
      try {
        if (detail.remotePeer.equals(this.serverPeerId)) {
          this.dispatchEvent(new CustomEvent<void>('connected'));
          logger.trace('🔗 Client connected to server at:', new Date().toISOString());
        }
      } catch (error) {
        logger.error(error);
      }
    });

    this.libp2p.addEventListener('peer:disconnect', ({ detail }) => {
      try {
        if (detail.remotePeer.equals(this.serverPeerId)) {
          this.dispatchEvent(new CustomEvent<void>('disconnected'));
          logger.trace('🔌 Client disconnected from server at:', new Date().toISOString());
        }
      } catch (error) {
        logger.error(error);
      }
    });

    this.libp2p.pubsub.addEventListener('message', ({ detail }) => {
      logger.trace(`Message on topic ${detail.topic}`);
      try {
        if (!this.requestsRegistry) {
          throw new Error('Requests registry not initialized yet');
        }

        let offer = JSON.parse(decodeText(detail.data)) as OfferData<
          CustomRequestQuery,
          CustomOfferOptions
        >;

        // Check is the message is an offer
        offer = createOfferDataSchema<CustomRequestQuery, CustomOfferOptions>(
          this.querySchema,
          this.offerOptionsSchema,
        ).parse(offer);
        logger.trace('Offer received:', offer);

        // Verify the offer
        // @todo Implement offer verification

        // Fetch associated request from the requests registry
        const requestId = (offer.request as RequestData<CustomRequestQuery>).id;
        const request = this.requestsRegistry.get(requestId);

        if (!request) {
          throw new Error(`Request #${requestId} not found in the registry`);
        }

        // Save the offer to the offers set of request
      } catch (error) {
        logger.error(error);
      }
    });

    this.requestsRegistry = new RequestsRegistry<CustomRequestQuery, CustomOfferOptions>(
      this,
      await this.storageInitializer<RawRequest<CustomRequestQuery, CustomOfferOptions>[]>(),
    );
    this.requestsRegistry.addEventListener('change', ({ detail }) => {
      this.dispatchEvent(
        new CustomEvent<Required<Request<CustomRequestQuery, CustomOfferOptions>>[]>('requests', {
          detail,
        }),
      );
    });

    await this.libp2p.start();
    this.dispatchEvent(new CustomEvent<void>('start'));
    logger.trace('🚀 Client started at:', new Date().toISOString());
  }

  async stop(): Promise<void> {
    if (!this.libp2p) {
      throw new Error('libp2p not initialized yet');
    }

    await this.libp2p.stop();
    this.dispatchEvent(new CustomEvent<void>('stop'));
    logger.trace('👋 Client stopped at:', new Date().toISOString());
  }

  async buildRequest(
    topic: string,
    expire: string | number,
    nonce: number,
    query: CustomRequestQuery,
  ): Promise<Request<CustomRequestQuery, CustomOfferOptions>> {
    if (!this.libp2p || !this.requestsRegistry) {
      throw new Error('Client not initialized yet');
    }

    const request = new Request({
      pubsub: this.libp2p.pubsub as CenterSub,
      querySchema: this.querySchema,
      offerOptionsSchema: this.offerOptionsSchema,
      contractConfig: this.contractConfig,
      provider: this.provider,
    });
    await request.build(topic, expire, nonce, query);
    this.requestsRegistry.set(request);

    return request;
  }

  _getRequests(): Required<Request<CustomRequestQuery, CustomOfferOptions>>[] {
    if (!this.requestsRegistry) {
      throw new Error('Client not initialized yet');
    }

    return this.requestsRegistry.getAll();
  }

  _getRequest(id: string): Request<CustomRequestQuery, CustomOfferOptions> | undefined {
    if (!this.requestsRegistry) {
      throw new Error('Client not initialized yet');
    }

    return this.requestsRegistry.get(id);
  }

  _deleteRequest(id: string): boolean {
    if (!this.requestsRegistry) {
      throw new Error('Client not initialized yet');
    }

    return this.requestsRegistry.delete(id);
  }

  _clearRequests(): void {
    if (!this.requestsRegistry) {
      throw new Error('Client not initialized yet');
    }

    return this.requestsRegistry.clear();
  }

  get requests() {
    return {
      get: this._getRequest.bind(this),
      getAll: this._getRequests.bind(this),
      delete: this._deleteRequest.bind(this),
      clear: this._clearRequests.bind(this),
    };
  }
}

export const createClient = <
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
>(
  options: ClientOptions<CustomRequestQuery, CustomOfferOptions>,
  storageInit: StorageInitializer,
): Client<CustomRequestQuery, CustomOfferOptions> => {
  return new Client(options, storageInit);
};
