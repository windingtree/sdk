import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import { z } from 'zod';
import { Client } from '../index.js';
import {
  GenericOfferOptions,
  GenericQuery,
  createRequestDataSchema,
  createOfferDataSchema,
  RequestData,
  OfferData,
} from '../shared/messages.js';
import { Storage } from '../storage/index.js';
import { createLogger } from '../utils/logger.js';
import { encodeText } from '../utils/text.js';
import { nowSec } from '../utils/time.js';

const logger = createLogger('RequestsRegistry');

/**
 * Creates request record schema
 *
 * @param {z.ZodType} querySchema Custom request query schema
 * @param {z.ZodType} offerOptionsSchema
 * @returns {z.ZodType} Request record schema
 */
export const createRequestRecordSchema = <
  TQuery extends z.ZodTypeAny,
  TOfferOptions extends z.ZodTypeAny,
>(
  querySchema: TQuery,
  offerOptionsSchema: TOfferOptions,
) =>
  z
    .object({
      /** Raw request data */
      data: createRequestDataSchema<TQuery>(querySchema),
      /** Offers associated with a request*/
      offers: z.array(
        createOfferDataSchema<TQuery, TOfferOptions>(querySchema, offerOptionsSchema),
      ),
      /** Request cancelation flag */
      cancelled: z.boolean().default(false),
    })
    .strict();

/**
 * Request registry keys prefix schema
 */
export const RequestRegistryPrefixSchema = z.string().default('requestsRegistry');

/**
 * Request manager initialization options schema
 *
 * @template CustomRequestQuery
 * @template CustomOfferOptions
 */
const createRequestManagerOptionsSchema = <
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
>() =>
  z
    .object({
      /** Instance of Client */
      client: z.instanceof(Client<CustomRequestQuery, CustomOfferOptions>),
      /** Instance of storage */
      storage: z.instanceof(Storage),
      prefix: RequestRegistryPrefixSchema,
    })
    .strict();

/**
 * Request manager initialization options type
 */
export type RequestManagerOptions<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> = z.infer<
  ReturnType<typeof createRequestManagerOptionsSchema<CustomRequestQuery, CustomOfferOptions>>
>;

/**
 * Request record type
 */
export type RequestRecord<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> = z.infer<
  ReturnType<
    typeof createRequestRecordSchema<z.ZodType<CustomRequestQuery>, z.ZodType<CustomOfferOptions>>
  >
>;

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
 * Requests manager
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
  subscriptions: Map<string, NodeJS.Timeout>;
  private client: Client<CustomRequestQuery, CustomOfferOptions>;
  private storage?: Storage;
  private storageKey: string;

  // @todo Refactor a RequestsRegistry arguments into options (with validation schema)
  constructor(options: RequestManagerOptions<CustomRequestQuery, CustomOfferOptions>) {
    super();

    const { client, storage, prefix } = createRequestManagerOptionsSchema<
      CustomRequestQuery,
      CustomOfferOptions
    >().parse(options);

    this.client = client;
    this.requests = new Map<string, RequestRecord<CustomRequestQuery, CustomOfferOptions>>();
    this.subscriptions = new Map();
    this.storageKey = `${prefix}_records`;
    this.storage = storage;
    this._storageUp().catch(logger.error);
  }

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

      for (let requestRecord of rawRecords) {
        try {
          requestRecord = createRequestRecordSchema<
            z.ZodType<CustomRequestQuery>,
            z.ZodType<CustomOfferOptions>
          >(this.client.querySchema, this.client.offerOptionsSchema).parse(requestRecord);

          // `record.data` marked as optional because of Zod generics issue
          this.requests.set(
            (requestRecord.data as RequestData<CustomRequestQuery>).id,
            requestRecord,
          );
          this._subscribe(requestRecord);
        } catch (error) {
          logger.error(error);
        }
      }
    }
  }

  private _storageDown(): void {
    if (!this.storage) {
      throw new Error('Invalid requests registry storage');
    }

    this.storage.set(this.storageKey, Array.from(this.requests.values())).catch(logger.error);
  }

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

  private _subscribe(record: RequestRecord<CustomRequestQuery, CustomOfferOptions>) {
    if (!this.client.libp2p || !this.client.connected) {
      throw new Error('Client not connected to the coordination server yet');
    }

    const request = record.data as RequestData<CustomRequestQuery>;

    const now = nowSec();

    if (request.expire < nowSec() || record.cancelled) {
      return;
    }

    this.client.libp2p.pubsub.subscribe(request.id);
    this.subscriptions.set(
      request.id,
      setTimeout(() => {
        this.dispatchEvent(
          new CustomEvent<string>('expire', {
            detail: request.id,
          }),
        );
        this._unsubscribe(request.id);
      }, (request.expire - now) * 1000),
    );
    this.dispatchEvent(
      new CustomEvent<string>('subscribe', {
        detail: request.id,
      }),
    );
  }

  subscribed(id: string) {
    return this.subscriptions.has(id);
  }

  add(request: RequestData<CustomRequestQuery>) {
    if (!this.client.libp2p || !this.client.connected) {
      throw new Error('Client not connected to the coordination server yet');
    }

    request = createRequestDataSchema<z.ZodType<CustomRequestQuery>>(this.client.querySchema).parse(
      request,
    );
    const requestRecord = createRequestRecordSchema<
      z.ZodType<CustomRequestQuery>,
      z.ZodType<CustomOfferOptions>
    >(this.client.querySchema, this.client.offerOptionsSchema).parse({
      data: request,
      offers: [],
    });

    this.requests.set(request.id, requestRecord);
    this.dispatchEvent(
      new CustomEvent<RequestRecord<CustomRequestQuery, CustomOfferOptions>>('request', {
        detail: requestRecord,
      }),
    );

    this._subscribe(requestRecord);

    this.client.libp2p.pubsub
      .publish(request.topic, encodeText(JSON.stringify(request)))
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

  get(id: string): RequestRecord<CustomRequestQuery, CustomOfferOptions> | undefined {
    return this.requests.get(id);
  }

  getAll(): Required<RequestRecord<CustomRequestQuery, CustomOfferOptions>>[] {
    return Array.from(this.requests.values()) as Required<
      RequestRecord<CustomRequestQuery, CustomOfferOptions>
    >[];
  }

  cancel(id: string) {
    const record = this.requests.get(id);

    if (!record) {
      throw new Error(`Request #${id} not found`);
    }

    record.cancelled = true;

    this.requests.set(
      id,
      createRequestRecordSchema<z.ZodType<CustomRequestQuery>, z.ZodType<CustomOfferOptions>>(
        this.client.querySchema,
        this.client.offerOptionsSchema,
      ).parse(record),
    );
    this.dispatchEvent(
      new CustomEvent<string>('cancel', {
        detail: id,
      }),
    );
    this._unsubscribe(id);

    this._storageDown();
  }

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

  clear() {
    for (const id of this.subscriptions.keys()) {
      this.cancel(id);
    }
    this.requests.clear();
    this._storageDown();
    this.dispatchEvent(new CustomEvent<void>('clear'));
  }

  addOffer(offer: OfferData<CustomRequestQuery, CustomOfferOptions>) {
    offer = createOfferDataSchema<z.ZodType<CustomRequestQuery>, z.ZodType<CustomOfferOptions>>(
      this.client.querySchema,
      this.client.offerOptionsSchema,
    ).parse(offer);

    const requestId = (offer.request as RequestData<CustomRequestQuery>).id;
    const request = this.get(requestId);

    if (!request) {
      throw new Error(`Request #${requestId} not found`);
    }

    const offers = new Set(request.offers);
    offers.add(offer);

    this.requests.set(
      requestId,
      createRequestRecordSchema<z.ZodType<CustomRequestQuery>, z.ZodType<CustomOfferOptions>>(
        this.client.querySchema,
        this.client.offerOptionsSchema,
      ).parse({
        data: request.data,
        offers: Array.from(offers),
      }),
    );
    this.dispatchEvent(
      new CustomEvent<string>('offer', {
        detail: requestId,
      }),
    );

    this._storageDown();
  }
}
