import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import { AbstractProvider } from 'ethers';
import { z, ZodType } from 'zod';
import { GenericQuery, RequestData, createRequestDataSchema, buildRequest, GenericOfferOptions } from './messages.js';
import { Offer, RawOffer } from './offer.js';
import { CenterSub } from './pubsub.js';
import { encodeText } from '../utils/text.js';
import { hashObject } from '../utils/hash.js';
import { isExpired, nowSec } from '../utils/time.js';
import { ContractConfig, ContractConfigSchema } from '../utils/contract.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Request');

export const createRawRequestSchema = <CustomRequestQuery extends GenericQuery>(
  querySchema: z.ZodType<CustomRequestQuery>,
) =>
  z
    .object({
      data: createRequestDataSchema<CustomRequestQuery>(querySchema),
      topic: z.string(),
      offers: z.array(z.string()),
      published: z.number().optional(),
      received: z.number().optional(),
    })
    .strict();

// Request with metadata
export interface RawRequest<CustomRequestQuery extends GenericQuery, CustomOfferOptions extends GenericOfferOptions> {
  data: RequestData<CustomRequestQuery>;
  topic: string;
  offers: RawOffer<CustomRequestQuery, CustomOfferOptions>[];
  published?: number;
  received?: number;
}

export const createRequestInitOptionsSchema = <
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
>() =>
  z
    .object({
      querySchema: z.instanceof(ZodType<CustomRequestQuery>),
      offerOptionsSchema: z.instanceof(ZodType<CustomOfferOptions>),
      contractConfig: ContractConfigSchema,
      pubsub: z.instanceof(CenterSub),
      provider: z.instanceof(AbstractProvider).optional(),
    })
    .strict();

export type RequestInitOptions<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> = z.infer<ReturnType<typeof createRequestInitOptionsSchema<CustomRequestQuery, CustomOfferOptions>>>;

export interface RequestEvents<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> {
  /**
   * @example
   *
   * ```js
   * request.addEventListener('built', () => {
   *    // ... request built
   * })
   * ```
   */
  built: CustomEvent<void>;

  /**
   * @example
   *
   * ```js
   * request.addEventListener('restored', () => {
   *    // ... request restored from raw data
   * })
   * ```
   */
  restored: CustomEvent<void>;

  /**
   * @example
   *
   * ```js
   * request.addEventListener('published', () => {
   *    // ... published
   * })
   * ```
   */
  published: CustomEvent<void>;

  /**
   * @example
   *
   * ```js
   * request.addEventListener('expired', () => {
   *    // ... expired
   * })
   * ```
   */
  expired: CustomEvent<void>;

  /**
   * @example
   *
   * ```js
   * request.addEventListener('cancelled', () => {
   *    // ... cancelled
   * })
   * ```
   */
  cancelled: CustomEvent<void>;

  /**
   * @example
   *
   * ```js
   * request.addEventListener('changed', () => {
   *    // ... changed
   * })
   * ```
   */
  changed: CustomEvent<void>;

  /**
   * @example
   *
   * ```js
   * request.addEventListener('changed', () => {
   *    // ... changed
   * })
   * ```
   */
  offer: CustomEvent<Offer<CustomRequestQuery, CustomOfferOptions>>;
}

export class Request<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> extends EventEmitter<RequestEvents<CustomRequestQuery, CustomOfferOptions>> {
  private querySchema: z.ZodType<CustomRequestQuery>;
  private offerOptionsSchema: z.ZodType<CustomOfferOptions>;
  private contractConfig: ContractConfig;
  private pubsub: CenterSub;
  private provider?: AbstractProvider;
  private subscriptionTimeout?: NodeJS.Timeout;
  data?: RequestData<CustomRequestQuery>; // Request message content
  topic?: string;
  offers: Set<Offer<CustomRequestQuery, CustomOfferOptions>>; // Offers
  published?: number; // Time in milliseconds
  received?: number; // Time in milliseconds

  constructor(options: RequestInitOptions<CustomRequestQuery, CustomOfferOptions>) {
    super();

    options = createRequestInitOptionsSchema<CustomRequestQuery, CustomOfferOptions>().parse(options);

    this.pubsub = options.pubsub;
    this.contractConfig = options.contractConfig;
    this.querySchema = options.querySchema;
    this.offerOptionsSchema = options.offerOptionsSchema;
    this.offers = new Set<Offer<CustomRequestQuery, CustomOfferOptions>>();
  }

  get subscribed(): boolean {
    return !!this.subscriptionTimeout;
  }

  toJSON() {
    if (!this.data) {
      throw new Error('Request not initialized yet');
    }

    return JSON.stringify(this.data);
  }

  toRaw(): RawRequest<CustomRequestQuery, CustomOfferOptions> {
    if (!this.data || !this.topic) {
      throw new Error('Request not initialized yet');
    }

    return {
      data: this.data,
      topic: this.topic,
      published: this.published,
      received: this.received,
      offers: Array.from(this.offers).map((o) => o.toRaw()),
    };
  }

  toHash() {
    if (!this.data) {
      throw new Error('Request not initialized yet');
    }

    return hashObject(this.data, this.toJSON.bind(this));
  }

  async build(topic: string, expire: string | number, nonce: number, query: CustomRequestQuery) {
    if (!topic) {
      throw new Error('Request topic is required');
    }

    this.topic = topic;
    this.data = await buildRequest<CustomRequestQuery>(expire, nonce, query, this.querySchema);
    this.dispatchEvent(new CustomEvent<void>('built'));
    this.dispatchEvent(new CustomEvent<void>('changed'));
    logger.trace('Request data:', this.data);
  }

  async buildRaw(rawRequest: RawRequest<CustomRequestQuery, CustomOfferOptions>) {
    this.topic = rawRequest.topic;
    this.offers = new Set<Offer<CustomRequestQuery, CustomOfferOptions>>(
      await Promise.all(
        rawRequest.offers.map(async (ro) => {
          const offer = new Offer({
            passive: true,
            pubsub: this.pubsub,
            provider: this.provider,
            contractConfig: this.contractConfig,
            querySchema: this.querySchema,
            offerOptionsSchema: this.offerOptionsSchema,
            supplierId: ro.data.payload.supplierId,
          });
          await offer.buildRaw(ro);
          return offer;
        }),
      ),
    );
    this.published = rawRequest.published;
    this.received = rawRequest.received;

    this.data = await buildRequest<CustomRequestQuery>(
      rawRequest.data.expire,
      rawRequest.data.nonce,
      rawRequest.data.query as CustomRequestQuery, // @todo Fix it somehow
      this.querySchema,
      rawRequest.data.id,
    );
    this.dispatchEvent(new CustomEvent<void>('restored'));
    this.dispatchEvent(new CustomEvent<void>('changed'));
    logger.trace('Request data:', this.data);

    if (this.published && rawRequest.topic && !isExpired(this.data.expire)) {
      this.publish().catch(logger.trace);
    }
  }

  async publish(rePublish = false) {
    try {
      if (!this.data || !this.topic) {
        throw new Error('Request not initialized yet');
      }

      this.pubsub.subscribe(this.data.id);

      if (!this.published || rePublish) {
        await this.pubsub.publish(this.topic, encodeText(this.toJSON()));
      }

      this.subscriptionTimeout = setTimeout(() => {
        this.dispatchEvent(new CustomEvent<void>('expired'));
        this.cancel();
      }, (this.data.expire - nowSec()) * 1000);

      this.published = nowSec();
      this.dispatchEvent(new CustomEvent<void>('published'));
      this.dispatchEvent(new CustomEvent<void>('changed'));
      logger.trace(`Request #${this.data.id} published at`, this.published);
    } catch (error) {
      logger.error(error);
      this.cancel();
      throw error;
    }
  }

  cancel() {
    try {
      if (!this.data) {
        throw new Error('Request not initialized yet');
      }

      this.pubsub.unsubscribe(this.data.id);
      clearTimeout(this.subscriptionTimeout);
      this.subscriptionTimeout = undefined;
      this.dispatchEvent(new CustomEvent<void>('cancelled'));
      this.dispatchEvent(new CustomEvent<void>('changed'));
      logger.trace('Unsubscribed from:', this.data.id);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  addOffer(offer: Offer<CustomRequestQuery, CustomOfferOptions>) {
    try {
      if (!this.data) {
        throw new Error('Request not initialized yet');
      }

      if (!offer.verifyRequestId(this.data.id)) {
        throw new Error('Invalid request');
      }

      this.offers.add(offer);
      this.dispatchEvent(
        new CustomEvent<Offer<CustomRequestQuery, CustomOfferOptions>>('offer', {
          detail: offer,
        }),
      );
    } catch (error) {
      logger.error(error);
    }
  }
}
