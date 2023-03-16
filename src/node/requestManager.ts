import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import { z } from 'zod';
import { RequestData, GenericQuery, createRequestDataSchema } from '../common/messages.js';
import { RequestManagerOptions, createRequestManagerOptionsSchema } from '../common/options.js';
import { isExpired, nowSec } from '../utils/time.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('RequestManager');

export interface RequestEventPayload<CustomRequestQuery extends GenericQuery> {
  topic: string;
  data: RequestData<CustomRequestQuery>;
}

export interface RequestManagerEvents<CustomRequestQuery extends GenericQuery> {
  /**
   * @example
   *
   * ```js
   * request.addEventListener('request', () => {
   *    // ... request is ready
   * })
   * ```
   */
  request: CustomEvent<RequestEventPayload<CustomRequestQuery>>;
}

export class RequestManager<CustomRequestQuery extends GenericQuery> extends EventEmitter<
  RequestManagerEvents<CustomRequestQuery>
> {
  private querySchema: z.ZodType<CustomRequestQuery>;
  private noncePeriod: number;
  private cache: Map<string, RequestData<CustomRequestQuery>>;
  private cacheTopic: Map<string, string>;

  constructor(options: RequestManagerOptions<CustomRequestQuery>) {
    super();

    options = createRequestManagerOptionsSchema<CustomRequestQuery>().parse(options);

    this.cache = new Map<string, RequestData<CustomRequestQuery>>(); // requestId => request
    this.cacheTopic = new Map<string, string>(); // requestId => topic
    this.querySchema = options.querySchema;
    this.noncePeriod = options.noncePeriod;
  }

  add(topic: string, data: string) {
    const requestData = createRequestDataSchema<CustomRequestQuery>(this.querySchema).parse(
      JSON.parse(data),
    );

    if (isExpired(requestData.expire)) {
      logger.trace(`Request #${requestData.id} is expired`);
      return;
    }

    if (nowSec() + this.noncePeriod > requestData.expire) {
      logger.trace(`Request #${requestData.id} will expire before it can bee processed`);
      return;
    }

    if (!this.cache.has(requestData.id)) {
      // New request
      this.cache.set(requestData.id, requestData);
      this.cacheTopic.set(requestData.id, topic);
      setTimeout(() => {
        try {
          this.dispatchEvent(
            new CustomEvent('request', {
              detail: {
                topic,
                data: requestData,
              },
            }),
          );

          if (!this.cache.delete(requestData.id) || !this.cacheTopic.delete(requestData.id)) {
            throw new Error(`Unable to remove request #${requestData.id} from cache`);
          }
        } catch (error) {
          logger.error(error);
        }
      }, this.noncePeriod * 1000);
    } else {
      // Known request
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const knownRequest = this.cache.get(requestData.id)!;

      if (knownRequest.nonce < requestData.nonce) {
        this.cache.set(requestData.id, requestData);
      }
    }
  }
}
