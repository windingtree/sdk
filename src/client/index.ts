/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import { createLibp2p, Libp2pOptions, Libp2p, Libp2pInit } from 'libp2p';
import { noise } from '@chainsafe/libp2p-noise';
import { mplex } from '@libp2p/mplex';
import { webSockets } from '@libp2p/websockets';
import { all } from '@libp2p/websockets/filters';
import { multiaddr, Multiaddr } from '@multiformats/multiaddr';
import { peerIdFromString } from '@libp2p/peer-id';
import { PeerId } from '@libp2p/interface-peer-id';
import { OPEN } from '@libp2p/interface-connection/status';
import { Address, Chain, Hash, PublicClient, WalletClient } from 'viem';
import {
  BuildRequestOptions,
  OfferData,
  GenericOfferOptions,
  GenericQuery,
  RequestData,
  Contracts,
} from '../shared/types.js';
import { centerSub, CenterSub } from '../shared/pubsub.js';
import { buildRequest } from '../shared/messages.js';
import { ChainsConfigOption, ServerAddressOption } from '../shared/options.js';
import { RequestRecord, RequestsRegistry } from './requestsRegistry.js';
import { DealRecord, DealsRegistry } from './dealsRegistry.js';
import { decodeText } from '../utils/text.js';
import { StorageInitializer } from '../storage/index.js';
import { createLogger } from '../utils/logger.js';
import { TxCallback } from '../shared/contracts.js';

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

  /**
   * @example
   *
   * ```js
   * registry.addEventListener('deal:status', () => {
   *    // ... deal status changed
   * })
   * ```
   */
  'deal:status': CustomEvent<DealRecord<CustomRequestQuery, CustomOfferOptions>>;

  /**
   * @example
   *
   * ```js
   * registry.addEventListener('deal:changed', () => {
   *    // ... deals store changed
   * })
   * ```
   */
  'deal:changed': CustomEvent<void>;
}

/**
 * The protocol client initialization options
 */
export interface ClientOptions extends ChainsConfigOption, ServerAddressOption {
  /** libp2p configuration options */
  libp2p?: Libp2pInit;
  /** Storage initializer function */
  storageInitializer: StorageInitializer;
  /** DB keys prefix */
  dbKeysPrefix: string;
  /** Public client */
  publicClient: PublicClient;
  /** Wallet client */
  walletClient?: WalletClient;
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
  private dealsRegistry?: DealsRegistry<CustomRequestQuery, CustomOfferOptions>;
  private storageInitializer: StorageInitializer;
  private dbKeysPrefix: string;

  /** libp2p instance */
  libp2p?: Libp2p;
  /** Server instance multiaddr */
  serverMultiaddr: Multiaddr;
  /** Server peer Id */
  serverPeerId: PeerId;
  /** Protocol chain configuration */
  chain: Chain;
  /** Protocol smart contracts */
  contracts: Contracts;
  /** Public client */
  publicClient: PublicClient;
  /** Wallet client */
  walletClient?: WalletClient;

  /**
   *Creates an instance of Client.
   * @param {ClientOptions} options
   * @memberof Client
   */
  constructor(options: ClientOptions) {
    super();

    const {
      libp2p,
      serverAddress,
      storageInitializer,
      dbKeysPrefix,
      chain,
      contracts,
      publicClient,
      walletClient,
    } = options;

    // @todo Validate ClientOptions

    this.chain = chain;
    this.contracts = contracts;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.libp2pInit = (libp2p ?? {}) as Libp2pOptions;
    this.serverMultiaddr = multiaddr(serverAddress);
    const serverPeerIdString = this.serverMultiaddr.getPeerId();

    if (!serverPeerIdString) {
      throw new Error('Unable to extract peer id from the server address');
    }

    this.serverPeerId = peerIdFromString(serverPeerIdString);
    this.storageInitializer = storageInitializer;
    this.dbKeysPrefix = dbKeysPrefix;
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
        const offer = JSON.parse(decodeText(detail.data)) as OfferData<
          CustomRequestQuery,
          CustomOfferOptions
        >;

        // @todo Validate offer

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
      prefix: this.dbKeysPrefix,
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

    this.dealsRegistry = new DealsRegistry<CustomRequestQuery, CustomOfferOptions>({
      client: this,
      storage: await this.storageInitializer(),
      prefix: this.dbKeysPrefix,
      publicClient: this.publicClient,
      walletClient: this.walletClient,
    });

    this.dealsRegistry.addEventListener('status', () => {
      this.dispatchEvent(
        new CustomEvent<DealRecord<CustomRequestQuery, CustomOfferOptions>>('deal:status'),
      );
    });

    this.dealsRegistry.addEventListener('changed', () => {
      this.dispatchEvent(new CustomEvent<void>('deal:changed'));
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
    this.dealsRegistry?.stop();
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
   * @param {(Omit<BuildRequestOptions<CustomRequestQuery>, 'idOverride'>)} requestOptions
   * @returns {Promise<RequestData<CustomRequestQuery>>}
   * @memberof Client
   */
  private async _createRequest(
    requestOptions: Omit<BuildRequestOptions<CustomRequestQuery>, 'idOverride'>,
  ): Promise<RequestData<CustomRequestQuery>> {
    if (!this.libp2p || !this.requestsRegistry) {
      throw new Error('Client not initialized yet');
    }

    return await buildRequest<CustomRequestQuery>(requestOptions);
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
   * @memberof Client
   */
  private _clearRequests() {
    if (!this.requestsRegistry) {
      throw new Error('Client not initialized yet');
    }

    this.requestsRegistry.clear();
  }

  /**
   * Checks if request is currently subscribe by its Id
   *
   * @private
   * @param {string} id
   * @returns {boolean}
   * @memberof Client
   */
  private _subscribed(id: string): boolean {
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
      /** @see _cancelRequest */
      cancel: this._cancelRequest.bind(this),
      /** @see _deleteRequest */
      delete: this._deleteRequest.bind(this),
      /** @see _clearRequests */
      clear: this._clearRequests.bind(this),
      /** @see _subscribed */
      subscribed: this._subscribed.bind(this),
      /** @see _getRequest */
      get: this._getRequest.bind(this),
      /** @see _getRequests */
      getAll: this._getRequests.bind(this),
    };
  }

  /**
   * Creates a deal from offer
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer Offer data object
   * @param {Hash} paymentId Chosen payment Id (from offer.payment)
   * @param {Hash} retailerId Retailer Id
   * @param {WalletClient} [walletClient] Ethereum wallet client
   * @param {TxCallback} [txCallback] Optional transaction hash callback
   * @returns {Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>>} Deal record
   * @memberof DealsRegistry
   */
  private async _createDeal(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
    paymentId: Hash,
    retailerId: Hash,
    walletClient?: WalletClient,
    txCallback?: TxCallback,
  ): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>> {
    if (!this.dealsRegistry) {
      throw new Error('Client not initialized yet');
    }

    return await this.dealsRegistry.create(offer, paymentId, retailerId, walletClient, txCallback);
  }

  /**
   * Cancels the deal
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer Offer data object
   * @param {WalletClient} [walletClient] Ethereum wallet client
   * @param {TxCallback} [txCallback] Optional tx hash callback
   * @returns {Promise<void>}
   * @memberof DealsRegistry
   */
  private async _cancelDeal(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
    walletClient?: WalletClient,
    txCallback?: TxCallback,
  ): Promise<void> {
    if (!this.dealsRegistry) {
      throw new Error('Client not initialized yet');
    }

    await this.dealsRegistry.cancel(offer, walletClient, txCallback);
  }

  /**
   * Transfers the deal to another address
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer Offer data object
   * @param {Hash} to New owner address
   * @param {WalletClient} [walletClient] Ethereum wallet client
   * @param {TxCallback} [txCallback] Optional tx hash callback
   * @returns {Promise<void>}
   * @memberof DealsRegistry
   */
  private async _transferDeal(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
    to: Address,
    walletClient?: WalletClient,
    txCallback?: TxCallback,
  ): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>> {
    if (!this.dealsRegistry) {
      throw new Error('Client not initialized yet');
    }

    return await this.dealsRegistry.transfer(offer, to, walletClient, txCallback);
  }

  /**
   * Makes the deal check-in
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer Offer data object
   * @param {Hash} supplierSignature
   * @param {WalletClient} [walletClient] Ethereum wallet client
   * @param {TxCallback} [txCallback]
   * @returns {Promise<void>}
   * @memberof DealsRegistry
   */
  private async _checkInDeal(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
    supplierSignature: Hash,
    walletClient?: WalletClient,
    txCallback?: TxCallback,
  ): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>> {
    if (!this.dealsRegistry) {
      throw new Error('Client not initialized yet');
    }

    return await this.dealsRegistry.checkIn(offer, supplierSignature, walletClient, txCallback);
  }

  /**
   * Returns an up-to-date deal record
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer Offer data object
   * @returns {Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>>}
   * @memberof DealsRegistry
   */
  private async _getDeal(
    offer: OfferData<CustomRequestQuery, CustomOfferOptions>,
  ): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>> {
    if (!this.dealsRegistry) {
      throw new Error('Client not initialized yet');
    }

    return await this.dealsRegistry.get(offer);
  }

  /**
   * Returns all an up-to-date deal records
   *
   * @returns {Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>[]>}
   * @memberof DealsRegistry
   */
  private async _getDeals(): Promise<DealRecord<CustomRequestQuery, CustomOfferOptions>[]> {
    if (!this.dealsRegistry) {
      throw new Error('Client not initialized yet');
    }

    return await this.dealsRegistry.getAll();
  }

  /**
   * Provides access to subset of deals API
   *
   * @readonly
   * @memberof Client
   */
  get deals(): {
    create: Client<CustomRequestQuery, CustomOfferOptions>['_createDeal'];
    cancel: Client<CustomRequestQuery, CustomOfferOptions>['_cancelDeal'];
    transfer: Client<CustomRequestQuery, CustomOfferOptions>['_transferDeal'];
    checkIn: Client<CustomRequestQuery, CustomOfferOptions>['_checkInDeal'];
    get: Client<CustomRequestQuery, CustomOfferOptions>['_getDeal'];
    getAll: Client<CustomRequestQuery, CustomOfferOptions>['_getDeals'];
  } {
    return {
      /** @see _createDeal */
      create: this._createDeal.bind(this),
      /** @see _cancelDeal */
      cancel: this._cancelDeal.bind(this),
      /** @see _transferDeal */
      transfer: this._transferDeal.bind(this),
      /** @see _checkInDeal */
      checkIn: this._checkInDeal.bind(this),
      /** @see _getDeal */
      get: this._getDeal.bind(this),
      /** @see _getDeals */
      getAll: this._getDeals.bind(this),
    };
  }
}

/**
 * Creates client instance
 *
 * @param {ClientOptions} options Client initialization options
 * @returns {Client}
 */
export const createClient = <
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
>(
  options: ClientOptions,
): Client<CustomRequestQuery, CustomOfferOptions> => {
  return new Client(options);
};

/**
 * Requests registry exports
 */
export * from './requestsRegistry.js';

/**
 * Deals registry exports
 */
export * from './dealsRegistry.js';
