import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import {
  GenericOfferOptions,
  GenericQuery,
  RequestData,
  OfferData,
} from '@windingtree/sdk-types';
import { Storage } from '@windingtree/sdk-storage';
import { isExpired } from '@windingtree/sdk-utils';
import { createLogger } from '@windingtree/sdk-logger';

const logger = createLogger('RequestsRegistry');

/**
 * Request record type
 */
export interface ClientRequestRecord<
  CustomRequestQuery extends GenericQuery = GenericQuery,
  CustomOfferOptions extends GenericOfferOptions = GenericOfferOptions,
> {
  /** Raw request data */
  data: RequestData<CustomRequestQuery>;
  /** Offers associated with a request*/
  offers: OfferData<CustomRequestQuery, CustomOfferOptions>[];
  /** Request subscription flag indicating whether the request is currently subscribed or not */
  subscribed: boolean;
}

/**
 * Request manager initialization options type
 */
export interface ClientRequestsManagerOptions {
  /** Instance of storage used for persisting the state of the request manager */
  storage: Storage;
  /** Prefix used for the storage key to avoid potential key collisions */
  prefix: string;
}

/**
 * Request manager events interface
 */
export interface ClientRequestEvents<
  CustomRequestQuery extends GenericQuery = GenericQuery,
  CustomOfferOptions extends GenericOfferOptions = GenericOfferOptions,
> {
  /**
   * Event fired when a new request is added
   *
   * @example
   *
   * ```js
   * registry.addEventListener('request', () => {
   *    // ... request created
   * })
   * ```
   */
  request: CustomEvent<
    ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>
  >;

  /**
   * Event fired when a request is subscribed
   *
   * @example
   *
   * ```js
   * registry.addEventListener('subscribe', ({ details: id }) => {
   *    // ... request unsubscribed
   * })
   * ```
   */
  subscribe: CustomEvent<
    ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>
  >;

  /**
   * Event fired when a request is unsubscribed
   *
   * @example
   *
   * ```js
   * registry.addEventListener('unsubscribe', ({ details: id }) => {
   *    // ... request unsubscribed
   * })
   * ```
   */
  unsubscribe: CustomEvent<
    ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>
  >;

  /**
   * Event fired when a request expires
   *
   * @example
   *
   * ```js
   * registry.addEventListener('expire', ({ details: id }) => {
   *    // ... request expire
   * })
   * ```
   */
  expire: CustomEvent<
    ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>
  >;

  /**
   * Event fired when a request is cancelled
   *
   * @example
   *
   * ```js
   * registry.addEventListener('cancel', ({ details: id }) => {
   *    // ... request cancelled
   * })
   * ```
   */
  cancel: CustomEvent<
    ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>
  >;

  /**
   * Event fired when a request is deleted
   *
   * @example
   *
   * ```js
   * registry.addEventListener('delete', ({ details: id }) => {
   *    // ... request deleted
   * })
   * ```
   */
  delete: CustomEvent<
    ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>
  >;

  /**
   * Event fired when an offer is added to a request
   *
   * @example
   *
   * ```js
   * registry.addEventListener('offer', ({ details: id }) => {
   *    // ... offer added to request ${id}
   * })
   * ```
   */
  offer: CustomEvent<
    ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>
  >;

  /**
   * Event fired when all requests are cleared
   *
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
 * Client requests manager
 *
 * @class ClientRequestsManager
 * @extends {EventEmitter<ClientRequestEvents<CustomRequestQuery, CustomOfferOptions>>}
 * @template CustomRequestQuery
 * @template CustomOfferOptions
 */
export class ClientRequestsManager<
  CustomRequestQuery extends GenericQuery = GenericQuery,
  CustomOfferOptions extends GenericOfferOptions = GenericOfferOptions,
> extends EventEmitter<
  ClientRequestEvents<CustomRequestQuery, CustomOfferOptions>
> {
  /** Map for storing request records by their ID */
  private requests: Map<
    string,
    ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>
  >;
  /** Storage instance for persisting the state of the request manager */
  private storage: Storage;
  /** Key used for storing and retrieving the state of the request manager from the storage */
  private storageKey: string;

  /**
   * Creates an instance of ClientRequestsManager.
   *
   * @param {ClientRequestsManagerOptions<CustomRequestQuery, CustomOfferOptions>} options
   * @memberof ClientRequestsManager
   */
  constructor(options: ClientRequestsManagerOptions) {
    super();

    const { storage, prefix } = options;

    // @todo Validate ClientRequestsManagerOptions

    this.requests = new Map<
      string,
      ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>
    >();
    this.storageKey = `${prefix}_requests_records`;
    this.storage = storage;
    this._storageUp().catch(logger.error);
  }

  /**
   * Restores the state of the request manager from the storage
   *
   * @private
   * @returns {Promise<void>}
   * @memberof ClientRequestsManager
   */
  protected async _storageUp(): Promise<void> {
    if (!this.storage) {
      throw new Error('Invalid requests storage');
    }

    const rawRecords = await this.storage.get<
      ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>[]
    >(this.storageKey);

    if (rawRecords) {
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
   * Stores the state of the request manager to the storage
   *
   * @private
   * @memberof ClientRequestsManager
   */
  protected _storageDown(): void {
    if (!this.storage) {
      throw new Error('Invalid requests registry storage');
    }

    this.storage
      .set(this.storageKey, Array.from(this.requests.values()))
      .catch(logger.error);
  }

  /**
   * Unsubscribes a request from listening to offers
   *
   * @private
   * @param {ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>} record Request record
   * @returns {ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>}
   * @memberof ClientRequestsManager
   */
  private _unsubscribe(
    record: ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>,
  ): ClientRequestRecord<CustomRequestQuery, CustomOfferOptions> {
    const unsubscribedRecord = {
      ...record,
      subscribed: false,
    };

    this.requests.set(record.data.id, unsubscribedRecord);

    this.dispatchEvent(
      new CustomEvent<
        ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>
      >('unsubscribe', {
        detail: unsubscribedRecord,
      }),
    );

    return unsubscribedRecord;
  }

  /**
   * Subscribes a request to listen for offers
   *
   * @private
   * @param {ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>} record Request record
   * @returns {ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>}
   * @memberof ClientRequestsManager
   */
  private _subscribe(
    record: ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>,
  ): ClientRequestRecord<CustomRequestQuery, CustomOfferOptions> {
    if (!isExpired(record.data.expire) && !record.subscribed) {
      const subscribedRecord = {
        ...record,
        subscribed: true,
      };

      this.requests.set(record.data.id, subscribedRecord);

      this.dispatchEvent(
        new CustomEvent<
          ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>
        >('subscribe', {
          detail: subscribedRecord,
        }),
      );
    }

    return record;
  }

  /**
   * Adds a new request to the registry, publishes it and subscribes it to offers
   *
   * @param {RequestData<CustomRequestQuery>} request
   * @memberof ClientRequestsManager
   */
  add(request: RequestData<CustomRequestQuery>) {
    // @todo Validate request

    const record = this._subscribe({
      data: request,
      offers: [],
      subscribed: false,
    });

    this._storageDown();

    this.dispatchEvent(
      new CustomEvent<
        ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>
      >('request', {
        detail: record,
      }),
    );
  }

  /**
   * Returns a request record by its ID
   *
   * @param {string} id
   * @returns {(ClientRequestRecord<CustomRequestQuery, CustomOfferOptions> | undefined)}
   * @memberof ClientRequestsManager
   */
  get(
    id: string,
  ): ClientRequestRecord<CustomRequestQuery, CustomOfferOptions> | undefined {
    return this.requests.get(id);
  }

  /**
   * Returns an array of all registered request records
   *
   * @returns {Required<ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>>[]}
   * @memberof ClientRequestsManager
   */
  getAll(): Required<
    ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>
  >[] {
    return Array.from(this.requests.values()) as Required<
      ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>
    >[];
  }

  /**
   * Cancels a request by its ID. This stops its subscription to offers
   *
   * @param {string} id
   * @returns {boolean}
   * @memberof ClientRequestsManager
   */
  cancel(id: string): boolean {
    const record = this.get(id);

    if (record) {
      const cancelledRecord = this._unsubscribe(record);

      this._storageDown();

      this.dispatchEvent(
        new CustomEvent<
          ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>
        >('cancel', {
          detail: cancelledRecord,
        }),
      );

      return true;
    }

    return false;
  }

  /**
   * Removes a request from the registry by its ID
   *
   * @param {string} id
   * @returns {boolean}
   * @memberof ClientRequestsManager
   */
  delete(id: string): boolean {
    const record = this.get(id);

    if (record) {
      const deletedRecord = this._unsubscribe(record);

      const deleted = this.requests.delete(id);

      if (deleted) {
        this._storageDown();

        this.dispatchEvent(
          new CustomEvent<
            ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>
          >('delete', {
            detail: deletedRecord,
          }),
        );

        return true;
      }
    }

    return false;
  }

  /**
   * Clears the registry by removing all requests
   *
   * @memberof ClientRequestsManager
   */
  clear() {
    if (this.requests.size > 0) {
      for (const record of this.requests.values()) {
        if (record.subscribed) {
          this._unsubscribe(record);
        }
      }

      this.requests.clear();

      this._storageDown();

      this.dispatchEvent(new CustomEvent<void>('clear'));
    }
  }

  /**
   * Unsubscribes expired requests from listening to offers
   *
   * @memberof ClientRequestsManager
   */
  prune() {
    if (this.requests.size > 0) {
      const expiredRecords = [];

      for (const record of this.requests.values()) {
        if (record.subscribed && isExpired(record.data.expire)) {
          const unsubscribedRecord = this._unsubscribe(record);
          expiredRecords.push(unsubscribedRecord);
        }
      }

      if (expiredRecords.length > 0) {
        this._storageDown();

        for (const expiredRecord of expiredRecords) {
          this.dispatchEvent(
            new CustomEvent<
              ClientRequestRecord<CustomRequestQuery, CustomOfferOptions>
            >('expire', {
              detail: expiredRecord,
            }),
          );
        }
      }
    }
  }

  /**
   * Adds an offer to the associated request record
   *
   * @param {OfferData<CustomRequestQuery, CustomOfferOptions>} offer
   * @memberof ClientRequestsManager
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
      ...request,
      offers: Array.from(offers),
    });

    this._storageDown();

    this.dispatchEvent(
      new CustomEvent<string>('offer', {
        detail: requestId,
      }),
    );
  }

  refreshSubscriptions() {
    const requestIds = this.getAll().filter(
      (requestRecord) =>
        requestRecord.subscribed && !isExpired(requestRecord.data.expire),
    );

    requestIds.forEach((requestRecord) => {
      requestRecord.subscribed = false;
      this._subscribe(requestRecord);
    });
  }
}
