import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import { AbstractSigner, AbstractProvider } from 'ethers';
import { z, ZodType } from 'zod';
import { ContractConfig, ContractConfigSchema } from '../utils/contract.js';
import {
  GenericQuery,
  GenericOfferOptions,
  OfferData,
  buildOffer,
  RequestData,
  PaymentOption,
  CancelOption,
} from './messages.js';
import { CenterSub } from './pubsub.js';
import { encodeText } from '../utils/text.js';
import { hashObject } from '../utils/hash.js';
import { isExpired, nowSec } from '../utils/time.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Offer');

export interface RawOffer<CustomRequestQuery extends GenericQuery, CustomOfferOptions extends GenericOfferOptions> {
  data: OfferData<CustomRequestQuery, CustomOfferOptions>;
  published?: number;
}

export const createOfferInitOptionsSchema = <
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
>() =>
  z.object({
    passive: z.boolean().default(false),
    pubsub: z.instanceof(CenterSub),
    provider: z.instanceof(AbstractProvider),
    contractConfig: ContractConfigSchema,
    signer: z.instanceof(AbstractSigner).optional(),
    querySchema: z.instanceof(ZodType<CustomRequestQuery>),
    offerOptionsSchema: z.instanceof(ZodType<CustomOfferOptions>),
    supplierId: z.string().optional(),
  });

export type OfferInitOptions<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> = z.infer<ReturnType<typeof createOfferInitOptionsSchema<CustomRequestQuery, CustomOfferOptions>>>;

export interface OfferEvents {
  /**
   * @example
   *
   * ```js
   * offer.addEventListener('built', () => {
   *    // ... offer built
   * })
   * ```
   */
  built: CustomEvent<void>;

  /**
   * @example
   *
   * ```js
   * offer.addEventListener('restored', () => {
   *    // ... offer restored from raw data
   * })
   * ```
   */
  restored: CustomEvent<void>;

  /**
   * @example
   *
   * ```js
   * offer.addEventListener('published', () => {
   *    // ... published
   * })
   * ```
   */
  published: CustomEvent<void>;

  /**
   * @example
   *
   * ```js
   * offer.addEventListener('expired', () => {
   *    // ... expired
   * })
   * ```
   */
  expired: CustomEvent<void>;

  /**
   * @example
   *
   * ```js
   * offer.addEventListener('cancelled', () => {
   *    // ... cancelled
   * })
   * ```
   */
  cancelled: CustomEvent<void>;

  /**
   * @example
   *
   * ```js
   * offer.addEventListener('changed', () => {
   *    // ... changed
   * })
   * ```
   */
  changed: CustomEvent<void>;
}

export class Offer<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> extends EventEmitter<OfferEvents> {
  private passive: boolean; // Should check Deals or not
  private pubsub: CenterSub;
  private supplierId?: string;
  private contractConfig: ContractConfig;
  private signer?: AbstractSigner;
  private provider?: AbstractProvider;
  private querySchema: z.ZodType<CustomRequestQuery>;
  private offerOptionsSchema: z.ZodType<CustomOfferOptions>;
  private subscriptionTimeout?: NodeJS.Timeout;
  data?: OfferData<CustomRequestQuery, CustomOfferOptions>;
  published?: number; // Time in milliseconds
  deal?: number; // Deal token Id

  constructor(options: OfferInitOptions<CustomRequestQuery, CustomOfferOptions>) {
    super();

    options = createOfferInitOptionsSchema<CustomRequestQuery, CustomOfferOptions>().parse(options);

    this.passive = options.passive;
    this.pubsub = options.pubsub;
    this.supplierId = options.supplierId;
    this.contractConfig = options.contractConfig;
    this.signer = options.signer;
    this.provider = options.provider;
    this.querySchema = options.querySchema;
    this.offerOptionsSchema = options.offerOptionsSchema;
  }

  toJSON(): string {
    if (!this.data) {
      throw new Error('Offer not initialized yet');
    }

    return JSON.stringify(this.data);
  }

  toRaw(): RawOffer<CustomRequestQuery, CustomOfferOptions> {
    if (!this.data) {
      throw new Error('Offer not initialized yet');
    }

    return {
      data: this.data,
      published: this.published,
    };
  }

  toHash(): string {
    if (!this.data) {
      throw new Error('Request not initialized yet');
    }

    return hashObject(this.data, this.toJSON.bind(this));
  }

  async build(
    expire: string | number,
    request: RequestData<CustomRequestQuery>,
    options: CustomOfferOptions,
    payment: PaymentOption[],
    cancel: CancelOption[],
    checkIn: number,
    transferable = true,
  ) {
    if (!this.supplierId) {
      throw new Error('Invalid offer configuration: supplierId not found');
    }

    this.data = await buildOffer<CustomRequestQuery, CustomOfferOptions>(
      this.contractConfig,
      this.signer,
      this.querySchema,
      this.offerOptionsSchema,
      this.supplierId,
      expire,
      request,
      options,
      payment,
      cancel,
      checkIn,
      transferable,
    );
    this.dispatchEvent(new CustomEvent<void>('built'));
    this.dispatchEvent(new CustomEvent<void>('changed'));
    logger.trace('Offer data:', this.data);
  }

  async buildRaw(rawOffer: RawOffer<CustomRequestQuery, CustomOfferOptions>) {
    this.data = await buildOffer<CustomRequestQuery, CustomOfferOptions>(
      this.contractConfig,
      this.signer,
      this.querySchema,
      this.offerOptionsSchema,
      rawOffer.data.payload.supplierId,
      rawOffer.data.expire,
      rawOffer.data.request as RequestData<CustomRequestQuery>, // @todo Fix it somehow
      rawOffer.data.options as CustomOfferOptions,
      rawOffer.data.payment,
      rawOffer.data.cancel,
      rawOffer.data.payload.checkIn,
      rawOffer.data.payload.transferable,
      rawOffer.data.id,
      rawOffer.data.signature,
    );
    this.dispatchEvent(new CustomEvent<void>('restored'));
    this.dispatchEvent(new CustomEvent<void>('changed'));
    logger.trace('Offer data:', this.data);

    if (this.published && !isExpired((this.data.request as RequestData<CustomRequestQuery>).expire)) {
      this.publish().catch(logger.trace);
    }
  }

  async publish(rePublish = false): Promise<void> {
    try {
      if (!this.data) {
        throw new Error('Offer not initialized yet');
      }

      if (!this.passive) {
        // @todo Look up for a deal
        // @todo Subscribe to Deal if a deal is not found
      }

      if (!this.published || rePublish) {
        await this.pubsub.publish((this.data.request as RequestData<CustomRequestQuery>).id, encodeText(this.toJSON()));
      }

      this.subscriptionTimeout = setTimeout(() => {
        this.dispatchEvent(new CustomEvent<void>('expired'));
        this.cancel();
      }, (this.data.expire - nowSec()) * 1000);

      this.published = nowSec();
      this.dispatchEvent(new CustomEvent<void>('published'));
      this.dispatchEvent(new CustomEvent<void>('changed'));
      logger.trace(`Offer #${this.data.id} published at`, this.published);
    } catch (error) {
      logger.error(error);
      this.cancel();
      throw error;
    }
  }

  cancel(): void {
    try {
      if (!this.data) {
        throw new Error('Offer not initialized yet');
      }

      this.pubsub.unsubscribe((this.data.request as RequestData<CustomRequestQuery>).id);
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
