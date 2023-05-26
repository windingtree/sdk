import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import { Client } from '../index.js';
import { GenericOfferOptions, GenericQuery, RequestData, OfferData } from '../shared/types.js';
import { Storage } from '../storage/index.js';
import { encodeText } from '../utils/text.js';
import { nowSec } from '../utils/time.js';
import { stringify } from '../utils/hash.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('RequestsRegistry');

/**
 * Request record type
 */
export interface RequestRecord<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> {
  /** Raw request data */
  data: RequestData<CustomRequestQuery>;
  /** Offers associated with a request*/
  offers: OfferData<CustomRequestQuery, CustomOfferOptions>[];
  /** Request cancelation flag */
  cancelled: boolean;
}

/**
 * Request manager initialization options type
 */
export interface RequestsRegistryOptions<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> {
  /** Instance of Client */
  client: Client<CustomRequestQuery, CustomOfferOptions>;
  /** Instance of storage */
  storage: Storage;
  /** Registry storage prefix */
  prefix: string;
}

/**
 * Request manager events interface
 */
export interface RequestEvents<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> {
  /**
   * @example
   *
   * ```js
   * registry.addEventListener('request', () => {
   *    // ... request created
   * })
   * ```
   */
  request: CustomEvent<RequestRecord<CustomRequestQuery, CustomOfferOptions>>;

  /**
   * @example
   *
   * ```js
   * registry.addEventListener('publish', ({ details: id }) => {
   *    // ... request published
   * })
   * ```
   */
  publish: CustomEvent<string>;

  /**
   * @example
   *
   * ```js
   * registry.addEventListener('subscribe', ({ details: id }) => {
   *    // ... request unsubscribed
   * })
   * ```
   */
  subscribe: CustomEvent<string>;

  /**
   * @example
   *
   * ```js
   * registry.addEventListener('unsubscribe', ({ details: id }) => {
   *    // ... request unsubscribed
   * })
   * ```
   */
  unsubscribe: CustomEvent<string>;

  /**
   * @example
   *
   * ```js
   * registry.addEventListener('expire', ({ details: id }) => {
   *    // ... request expire
   * })
   * ```
   */
  expire: CustomEvent<string>;

  /**
   * @example
   *
   * ```js
   * registry.addEventListener('cancel', ({ details: id }) => {
   *    // ... request cancelled
   * })
   * ```
   */
  cancel: CustomEvent<string>;

  /**
   * @example
   *
   * ```js
   * registry.addEventListener('delete', ({ details: id }) => {
   *    // ... request deleted
   * })
   * ```
   */
  delete: CustomEvent<string>;

  /**
   * @example
   *
   * ```js
   * registry.addEventListener('offer', ({ details: id }) => {
   *    // ... offer added to request ${id}
   * })
   * ```
   */
  offer: CustomEvent<string>;

  /**
   * @example
   *
   * ```js
   * registry.addEventListener('clear', () => {
   *    // ... requests are cleared
   * })
   * ```
   */
  clear: CustomEvent<void>;
}

/**
 * Requests registry
 *
 * @class RequestsRegistry
 * @extends {EventEmitter<RequestEvents<CustomRequestQuery, CustomOfferOptions>>}
 * @template CustomRequestQuery
 * @template CustomOfferOptions
 */
export class RequestsRegistry<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> extends EventEmitter<RequestEvents<CustomRequestQuery, CustomOfferOptions>> {
  private requests: Map<string, RequestRecord<CustomRequestQuery, CustomOfferOptions>>; // id => RawRequest
  private client: Client<CustomRequestQuery, CustomOfferOptions>;
  private storage?: Storage;
  private storageKey: string;
  subscriptions: Map<string, NodeJS.Timeout>;

  /**
   * Creates an instance of RequestsRegistry.
   *
   * @param {RequestsRegistryOptions<CustomRequestQuery, CustomOfferOptions>} options
   * @memberof RequestsRegistry
   */
  constructor(options: RequestsRegistryOptions<CustomRequestQuery, CustomOfferOptions>) {
    super();

    const { client, storage, prefix } = options;

    // @todo Validate RequestsRegistryOptions

    this.client = client;
    this.requests = new Map<string, RequestRecord<CustomRequestQuery, CustomOfferOptions>>();
    this.subscriptions = new Map();
    this.storageKey = `${prefix}_requests_records`;
    this.storage = storage;
    this._storageUp().catch(logger.error);
  }

  /**
   * Restores class state from the storage
   *
   * @private
   * @returns {Promise<void>}
   * @memberof RequestsRegistry
   */
  private async _storageUp(): Promise<void> {
    if (!this.storage) {
      throw new Error('Invalid requests registry storage');
    }

    const rawRecords = await this.storage.get<
      RequestRecord<CustomRequestQuery, CustomOfferOptions>[]
    >(this.storageKey);

    if (rawRecords) {
      if (!this.client.libp2p) {
        throw new Error('libp2p not initialized yet');
      }

      for (const requestRecord of rawRecords) {
        try {
          this.requests.set(requestRecord.data.id, requestRecord);
          this._subscribe(requestRecord);
        } catch (error) {
          logger.error(error);
        }
      }
    }
  }

  /**
   * Stores class state to the storage
   *
   * @private
   * @memberof RequestsRegistry
   */
  private _storageDown(): void {
    if (!this.storage) {
      throw new Error('Invalid requests registry storage');
    }

    this.storage.set(this.storageKey, Array.from(this.requests.values())).catch(logger.error);
  }

  /**
   * Unsubscribes a request from listening to offers
   *
   * @private
   * @param {string} id
   * @memberof RequestsRegistry
   */
  private _unsubscribe(id: string) {
    const timeout = this.subscriptions.get(id);

    if (timeout) {
      if (this.client.libp2p && this.client.connected) {
        this.client.libp2p.pubsub.unsubscribe(id);
      }

      clearTimeout(timeout);
      this.subscriptions.delete(id);
      this.dispatchEvent(
        new CustomEvent<string>('unsubscribe', {
          detail: id,
        }),
      );
    }
  }

  /**
   * Subscribes a request
   *
   * @private
   * @param {RequestRecord<CustomRequestQuery, CustomOfferOptions>} record
   * @returns
   * @memberof RequestsRegistry
   */
  private _subscribe(record: RequestRecord<CustomRequestQuery, CustomOfferOptions>) {
    if (!this.client.libp2p || !this.client.connected) {
      throw new Error('Client not connected to the coordination server yet');
    }

    const now = BigInt(nowSec());

    if (BigInt(record.data.expire) < nowSec() || record.cancelled) {
      return;
    }

    this.client.libp2p.pubsub.subscribe(record.data.id);
    this.subscriptions.set(
      record.data.id,
      setTimeout(() => {
        this.dispatchEvent(
          new CustomEvent<string>('expire', {
            detail: record.data.id,
          }),
        );
        this._unsubscribe(record.data.id);
      }, Number((BigInt(record.data.expire) - now) * BigInt(1000))),
    );
    this.dispatchEvent(
      new CustomEvent<string>('subscribe', {
        detail: record.data.id,
      }),
    );
  }

  /**
   * Checks if request is currently subscribed
   *
   * @param {string} id
   * @returns
   * @memberof RequestsRegistry
   */
  subscribed(id: string) {
    return this.subscriptions.has(id);
  }

  /**
   * Adds request to the registry, publishes it and subscribes to offers
   *
   * @param {RequestData<CustomRequestQuery>} request
   * @memberof RequestsRegistry
   */
  add(request: RequestData<CustomRequestQuery>) {
    if (!this.client.libp2p || !this.client.connected) {
      throw new Error('Client not connected to the coordination server yet');
    }

    // @todo Validate RequestData

    const requestRecord: RequestRecord<CustomRequestQuery, CustomOfferOptions> = {
      data: request,
      offers: [],
      cancelled: false,
    };

    // @todo Validate requestRecord

    this.requests.set(request.id, requestRecord);
    this.dispatchEvent(
      new CustomEvent<RequestRecord<CustomRequestQuery, CustomOfferOptions>>('request', {
        detail: requestRecord,
      }),
    );

    this._subscribe(requestRecord);

    this.client.libp2p.pubsub
      .publish(request.topic, encodeText(stringify(request)))
      .then(() => {
        this.dispatchEvent(
          new CustomEvent<string>('published', {
            detail: request.id,
          }),
        );
      })
      .then(() => this._storageDown())
      .catch(logger.error);
  }

  /**
   * Returns request record by Id
   *
   * @param {string} id
   * @returns {(RequestRecord<CustomRequestQuery, CustomOfferOptions> | undefined)}
   * @memberof RequestsRegistry
   */
  get(id: string): RequestRecord<CustomRequestQuery, CustomOfferOptions> | undefined {
    return this.requests.get(id);
  }

  /**
   * Returns an array of all registered records
   *
   * @returns {Required<RequestRecord<CustomRequestQuery, CustomOfferOptions>>[]}
   * @memberof RequestsRegistry
   */
  getAll(): Required<RequestRecord<CustomRequestQuery, CustomOfferOptions>>[] {
    return Array.from(this.requests.values()) as Required<
      RequestRecord<CustomRequestQuery, CustomOfferOptions>
    >[];
  }

  /**
   * Cancels the request. This stops its subscription to offers
   *
   * @param {string} id
   * @memberof RequestsRegistry
   */
  cancel(id: string) {
    const record = this.requests.get(id);

    if (!record) {
      throw new Error(`Request #${id} not found`);
    }

    this.requests.set(id, {
      ...record,
      cancelled: true,
    });
    this.dispatchEvent(
      new CustomEvent<string>('cancel', {
        detail: id,
      }),
    );
    this._unsubscribe(id);

    this._storageDown();
  }

  /**
   * Removes a request from registry by Id
   *
   * @param {string} id
   * @returns
   * @memberof RequestsRegistry
   */
  delete(id: string) {
    this._unsubscribe(id);
    const deleted = this.requests.delete(id);

    if (deleted) {
      this.dispatchEvent(
        new CustomEvent<string>('delete', {
          detail: id,
        }),
      );
      this._storageDown();
      return;
    }

    throw new Error(`Unable to delete request #${id}`);
  }

  /**
   * Clear the registry
   *
   * @memberof RequestsRegistry
   */
  clear() {
    for (const id of this.subscriptions.keys()) {
      this.cancel(id);
    }
    this.requests.clear();
    this._storageDown();
    this.dispatchEvent(new CustomEvent<void>('clear'));
  }

  /**
   * Adds an offer to the associated request record
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer
   * @memberof RequestsRegistry
   */
  addOffer(offer: OfferData<CustomRequestQuery, CustomOfferOptions>) {
    // @todo Validate offer

    const requestId = offer.request.id;
    const request = this.get(requestId);

    if (!request) {
      throw new Error(`Request #${requestId} not found`);
    }

    const offers = new Set(request.offers);
    offers.add(offer);

    this.requests.set(requestId, {
      data: request.data,
      offers: Array.from(offers),
      cancelled: false,
    });
    this.dispatchEvent(
      new CustomEvent<string>('offer', {
        detail: requestId,
      }),
    );

    this._storageDown();
  }
}
