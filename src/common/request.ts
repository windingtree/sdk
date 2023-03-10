import { z, ZodType } from 'zod';
import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import { GenericQuery, RequestData, buildRequest, buildRequestSync } from './messages.js';
import { CenterSub } from './pubsub.js';
import { encodeText } from '../utils/text.js';
import { hashObject } from '../utils/hash.js';
import { isExpired, nowSec } from '../utils/time.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Request');
logger.enabled = true;

// Request with metadata
export interface RawRequest<CustomRequestQuery extends GenericQuery> {
  data: RequestData<CustomRequestQuery>;
  topic: string;
  offers: string[];
  published?: number;
  received?: number;
}

export interface RequestEvents {
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
}

export class Request<CustomRequestQuery extends GenericQuery> extends EventEmitter<RequestEvents> {
  private pubsub: CenterSub;
  private querySchema: z.ZodType<CustomRequestQuery>;
  private subscriptionTimeout?: NodeJS.Timeout;
  data?: RequestData<CustomRequestQuery>; // Request message content
  topic?: string;
  offers: Set<string>; // Offers Ids
  published?: number; // Time in milliseconds
  received?: number; // Time in milliseconds

  constructor(
    pubsub: CenterSub,
    querySchema: z.ZodType<CustomRequestQuery>,
    rawRequest?: RawRequest<CustomRequestQuery>,
  ) {
    super();

    if (!(pubsub instanceof CenterSub)) {
      throw new Error('Pubsub option of Request must be instance of CenterSub');
    }

    if (!(querySchema instanceof ZodType)) {
      throw new Error('QuerySchema option of Request must be instance of ZodType');
    }

    this.pubsub = pubsub;
    this.querySchema = querySchema;
    this.offers = new Set<string>();

    if (rawRequest) {
      this.data = buildRequestSync<CustomRequestQuery>(
        rawRequest.data.expire,
        rawRequest.data.nonce,
        rawRequest.data.query as unknown as CustomRequestQuery, // @todo Fix it somehow
        this.querySchema,
        rawRequest.data.id,
      );
      this.topic = rawRequest.topic;
      this.offers = new Set<string>(rawRequest.offers);
      this.published = rawRequest.published;
      this.received = rawRequest.received;

      if (this.published && rawRequest.topic && !isExpired(this.data.expire)) {
        this.publish().catch(logger.trace);
      }
    }
  }

  get subscribed(): boolean {
    return !!this.subscriptionTimeout;
  }

  toJSON(): string {
    if (!this.data) {
      throw new Error('Request not initialized yet');
    }

    return JSON.stringify(this.data);
  }

  toRaw(): RawRequest<CustomRequestQuery> {
    if (!this.data || !this.topic) {
      throw new Error('Request not initialized yet');
    }

    return {
      data: this.data,
      topic: this.topic,
      published: this.published,
      received: this.received,
      offers: Array.from(this.offers),
    };
  }

  toHash(): string {
    if (!this.data) {
      throw new Error('Request not initialized yet');
    }

    return hashObject(this.data, this.toJSON.bind(this));
  }

  async build(topic: string, expire: string | number, nonce: number, query: CustomRequestQuery): Promise<void> {
    if (!topic) {
      throw new Error('Request topic is required');
    }

    this.topic = topic;
    this.data = await buildRequest<CustomRequestQuery>(expire, nonce, query, this.querySchema);
    this.dispatchEvent(new CustomEvent<void>('built'));
    this.dispatchEvent(new CustomEvent<void>('changed'));
    logger.trace('Request data:', this.data);
  }

  async publish(rePublish = false): Promise<void> {
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

  cancel(): void {
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
}
