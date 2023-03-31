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
  buildRequest,
  BuildRequestOptions,
  createOfferDataSchema,
  GenericOfferOptions,
  GenericQuery,
  RequestData,
} from '../shared/messages.js';
import { ClientOptions, createClientOptionsSchema } from '../shared/options.js';
import { RequestRecord, RequestsRegistry } from './requestManager.js';
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
   * client.addEventListener('request:create', () => {
   *    // ... request created
   * })
   * ```
   */
  'request:create': CustomEvent<RequestRecord<CustomRequestQuery, CustomOfferOptions>>;

  /**
   * @example
   *
   * ```js
   * client.addEventListener('request:publish', ({ details: id }) => {
   *    // ... request published
   * })
   * ```
   */
  'request:publish': CustomEvent<string>;

  /**
   * @example
   *
   * ```js
   * client.addEventListener('request:subscribe', ({ details: id }) => {
   *    // ... request unsubscribed
   * })
   * ```
   */
  'request:subscribe': CustomEvent<string>;

  /**
   * @example
   *
   * ```js
   * client.addEventListener('request:unsubscribe', ({ details: id }) => {
   *    // ... request subscribed
   * })
   * ```
   */
  'request:unsubscribe': CustomEvent<string>;

  /**
   * @example
   *
   * ```js
   * client.addEventListener('request:expire', ({ details: id }) => {
   *    // ... request expired
   * })
   * ```
   */
  'request:expire': CustomEvent<string>;

  /**
   * @example
   *
   * ```js
   * client.addEventListener('request:cancel', ({ details: id }) => {
   *    // ... request cancelled
   * })
   * ```
   */
  'request:cancel': CustomEvent<string>;

  /**
   * @example
   *
   * ```js
   * client.addEventListener('request:delete', ({ details: id }) => {
   *    // ... request deleted
   * })
   * ```
   */
  'request:delete': CustomEvent<string>;

  /**
   * @example
   *
   * ```js
   * client.addEventListener('request:offer', ({ details: id }) => {
   *    // ... offer added to request ${id}
   * })
   * ```
   */
  'request:offer': CustomEvent<string>;

  /**
   * @example
   *
   * ```js
   * client.addEventListener('request:clear', () => {
   *    // ... requests are cleared
   * })
   * ```
   */
  'request:clear': CustomEvent<void>;
}

/**
 * The protocol Client class
 *
 * @class Client
 * @extends {EventEmitter<ClientEvents<CustomRequestQuery, CustomOfferOptions>>}
 * @template CustomRequestQuery
 * @template CustomOfferOptions
 */
export class Client<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> extends EventEmitter<ClientEvents<CustomRequestQuery, CustomOfferOptions>> {
  private libp2pInit: Libp2pOptions;
  private requestsRegistry?: RequestsRegistry<CustomRequestQuery, CustomOfferOptions>;
  private storageInitializer: StorageInitializer;
  private requestRegistryPrefix: string;

  /** libp2p instance */
  libp2p?: Libp2p;
  /** Server instance multiaddr */
  serverMultiaddr: Multiaddr;
  /** Server peer Id */
  serverPeerId: PeerId;
  /** Request query validation schema */
  querySchema: z.ZodType<CustomRequestQuery>;
  /** Offer options validation schema */
  offerOptionsSchema: z.ZodType<CustomOfferOptions>;
  /** Smart contract configuration */
  contractConfig: ContractConfig;
  /** Ethers.js provider instance */
  provider?: AbstractProvider;
  /**
   *Creates an instance of Client.
   * @param {ClientOptions<CustomRequestQuery, CustomOfferOptions>} options
   * @memberof Client
   */
  constructor(options: ClientOptions<CustomRequestQuery, CustomOfferOptions>) {
    super();

    const {
      querySchema,
      offerOptionsSchema,
      contractConfig,
      libp2p,
      provider,
      serverAddress,
      storageInitializer,
      requestRegistryPrefix,
    } = createClientOptionsSchema<CustomRequestQuery, CustomOfferOptions>().parse(options);

    this.querySchema = querySchema;
    this.offerOptionsSchema = offerOptionsSchema;
    this.contractConfig = contractConfig;
    this.libp2pInit = (libp2p ?? {}) as Libp2pOptions;
    this.provider = provider;
    this.serverMultiaddr = multiaddr(serverAddress);
    const serverPeerIdString = this.serverMultiaddr.getPeerId();

    if (!serverPeerIdString) {
      throw new Error('Unable to extract peer id from the server address');
    }

    this.serverPeerId = peerIdFromString(serverPeerIdString);
    this.storageInitializer = storageInitializer;
    this.requestRegistryPrefix = requestRegistryPrefix;
  }

  /**
   * Client connection status flag
   *
   * @readonly
   * @type {boolean}
   * @memberof Client
   */
  get connected(): boolean {
    return (
      !!this.libp2p &&
      (this.libp2p.pubsub as CenterSub).started &&
      this.libp2p.getPeers().length > 0 &&
      this.libp2p.getConnections(this.serverPeerId)[0]?.stat.status === OPEN
    );
  }

  /**
   * Starts the client
   *
   * @returns {Promise<void>}
   * @memberof Client
   */
  async start(): Promise<void> {
    const config: Libp2pOptions = {
      transports: [webSockets({ filter: all })],
      streamMuxers: [mplex()],
      connectionEncryption: [noise()],
      pubsub: centerSub({
        isClient: true,
        /** Client must be connected to the coordination server */
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

        /** Check is the message is an offer */
        const offer = createOfferDataSchema<
          z.ZodType<CustomRequestQuery>,
          z.ZodType<CustomOfferOptions>
        >(this.querySchema, this.offerOptionsSchema).parse(JSON.parse(decodeText(detail.data)));
        logger.trace('Offer received:', offer);

        // Verify the offer
        // @todo Implement offer verification

        logger.trace('Offer:', offer);

        /** Add the offer to the associated request */
        this.requestsRegistry.addOffer(offer);
      } catch (error) {
        logger.error(error);
      }
    });

    this.requestsRegistry = new RequestsRegistry<CustomRequestQuery, CustomOfferOptions>({
      client: this,
      storage: await this.storageInitializer(),
      prefix: this.requestRegistryPrefix,
    });

    /**
     * Listening on request registry events
     */

    this.requestsRegistry.addEventListener('request', ({ detail }) => {
      this.dispatchEvent(
        new CustomEvent<RequestRecord<CustomRequestQuery, CustomOfferOptions>>('request:create', {
          detail,
        }),
      );
    });

    this.requestsRegistry.addEventListener('publish', ({ detail }) => {
      this.dispatchEvent(
        new CustomEvent<string>('request:publish', {
          detail,
        }),
      );
    });

    this.requestsRegistry.addEventListener('unsubscribe', ({ detail }) => {
      this.dispatchEvent(
        new CustomEvent<string>('request:unsubscribe', {
          detail,
        }),
      );
    });

    this.requestsRegistry.addEventListener('subscribe', ({ detail }) => {
      this.dispatchEvent(
        new CustomEvent<string>('request:subscribe', {
          detail,
        }),
      );
    });

    this.requestsRegistry.addEventListener('cancel', ({ detail }) => {
      this.dispatchEvent(
        new CustomEvent<string>('request:cancel', {
          detail,
        }),
      );
    });

    this.requestsRegistry.addEventListener('delete', ({ detail }) => {
      this.dispatchEvent(
        new CustomEvent<string>('request:delete', {
          detail,
        }),
      );
    });

    this.requestsRegistry.addEventListener('offer', ({ detail }) => {
      this.dispatchEvent(
        new CustomEvent<string>('request:offer', {
          detail,
        }),
      );
    });

    this.requestsRegistry.addEventListener('clear', () => {
      this.dispatchEvent(new CustomEvent<void>('request:clear'));
    });

    await this.libp2p.start();
    this.dispatchEvent(new CustomEvent<void>('start'));
    logger.trace('🚀 Client started at:', new Date().toISOString());
  }

  /**
   * Stops the client
   *
   * @returns {Promise<void>}
   * @memberof Client
   */
  async stop(): Promise<void> {
    if (!this.libp2p) {
      throw new Error('libp2p not initialized yet');
    }

    await this.libp2p.stop();
    this.dispatchEvent(new CustomEvent<void>('stop'));
    logger.trace('👋 Client stopped at:', new Date().toISOString());
  }

  /**
   *
   * Requests API
   *
   */

  /**
   * Creates a new request
   *
   * @private
   * @param {(Omit<BuildRequestOptions<CustomRequestQuery>, 'querySchema' | 'idOverride'>)} requestOptions
   * @returns {Promise<RequestData<CustomRequestQuery>>}
   * @memberof Client
   */
  private async _createRequest(
    requestOptions: Omit<BuildRequestOptions<CustomRequestQuery>, 'querySchema' | 'idOverride'>,
  ): Promise<RequestData<CustomRequestQuery>> {
    if (!this.libp2p || !this.requestsRegistry) {
      throw new Error('Client not initialized yet');
    }

    return await buildRequest<CustomRequestQuery>({
      ...requestOptions,
      querySchema: this.querySchema,
    } as BuildRequestOptions<CustomRequestQuery>);
  }

  /**
   * Adds request to the request registry
   *
   * @private
   * @param {RequestData<CustomRequestQuery>} request
   * @returns
   * @memberof Client
   */
  private _addRequest(request: RequestData<CustomRequestQuery>) {
    if (!this.requestsRegistry) {
      throw new Error('Client not initialized yet');
    }

    return this.requestsRegistry.add(request);
  }

  /**
   * Returns all requests from the registry
   *
   * @private
   * @returns {Required<RequestRecord<CustomRequestQuery, CustomOfferOptions>>[]}
   * @memberof Client
   */
  private _getRequests(): Required<RequestRecord<CustomRequestQuery, CustomOfferOptions>>[] {
    if (!this.requestsRegistry) {
      throw new Error('Client not initialized yet');
    }

    return this.requestsRegistry.getAll();
  }

  /**
   * Return request from the registry by Id
   *
   * @private
   * @param {string} id
   * @returns {(RequestRecord<CustomRequestQuery, CustomOfferOptions> | undefined)}
   * @memberof Client
   */
  private _getRequest(
    id: string,
  ): RequestRecord<CustomRequestQuery, CustomOfferOptions> | undefined {
    if (!this.requestsRegistry) {
      throw new Error('Client not initialized yet');
    }

    return this.requestsRegistry.get(id);
  }

  /**
   * Cancels request by Id
   *
   * @private
   * @param {string} id
   * @memberof Client
   */
  private _cancelRequest(id: string) {
    if (!this.requestsRegistry) {
      throw new Error('Client not initialized yet');
    }

    this.requestsRegistry.cancel(id);
  }

  /**
   * Deletes request by Id
   *
   * @private
   * @param {string} id
   * @memberof Client
   */
  private _deleteRequest(id: string) {
    if (!this.requestsRegistry) {
      throw new Error('Client not initialized yet');
    }

    this.requestsRegistry.delete(id);
  }

  /**
   * Cancels and removes all requests from registry
   *
   * @private
   * @returns
   * @memberof Client
   */
  private _clearRequests() {
    if (!this.requestsRegistry) {
      throw new Error('Client not initialized yet');
    }

    return this.requestsRegistry.clear();
  }

  /**
   * Checks if request is currently subscribe by its Id
   *
   * @private
   * @param {string} id
   * @returns
   * @memberof Client
   */
  private _subscribed(id: string) {
    if (!this.requestsRegistry) {
      throw new Error('Client not initialized yet');
    }

    return this.requestsRegistry.subscribed(id);
  }

  /**
   * Provides access to subset of requests API
   *
   * @readonly
   * @memberof Client
   */
  get requests() {
    return {
      /** @see _createRequest */
      create: this._createRequest.bind(this),
      /** @see _addRequest */
      publish: this._addRequest.bind(this),
      /** @see _getRequest */
      get: this._getRequest.bind(this),
      /** @see _getRequests */
      getAll: this._getRequests.bind(this),
      /** @see _cancelRequest */
      cancel: this._cancelRequest.bind(this),
      /** @see _deleteRequest */
      delete: this._deleteRequest.bind(this),
      /** @see _clearRequests */
      clear: this._clearRequests.bind(this),
      /** @see _subscribed */
      subscribed: this._subscribed.bind(this),
    };
  }
}

/**
 * Creates client instance
 *
 * @param {ClientOptions<CustomRequestQuery, CustomOfferOptions>} options Client initialization options
 * @returns {Client}
 */
export const createClient = <
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
>(
  options: ClientOptions<CustomRequestQuery, CustomOfferOptions>,
): Client<CustomRequestQuery, CustomOfferOptions> => {
  return new Client(options);
};
