import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import { RequestData, GenericQuery } from '../shared/types.js';
import { NoncePeriodOption } from '../shared/options.js';
import { isExpired, nowSec, parseSeconds } from '../utils/time.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('RequestManager');

/**
 * Request manager (of the protocol node) initialization options type
 */
export type RequestManagerOptions = NoncePeriodOption;

export interface RequestEvent<CustomRequestQuery extends GenericQuery> {
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
  request: CustomEvent<RequestEvent<CustomRequestQuery>>;
}

export class RequestManager<CustomRequestQuery extends GenericQuery> extends EventEmitter<
  RequestManagerEvents<CustomRequestQuery>
> {
  private noncePeriod: number;
  private cache: Map<string, RequestData<CustomRequestQuery>>;
  private cacheTopic: Map<string, string>;

  constructor(options: RequestManagerOptions) {
    super();

    const { noncePeriod } = options;

    // @todo Validate RequestManagerOptions

    this.cache = new Map<string, RequestData<CustomRequestQuery>>(); // requestId => request
    this.cacheTopic = new Map<string, string>(); // requestId => topic
    this.noncePeriod = Number(parseSeconds(noncePeriod));
  }

  add(topic: string, data: string) {
    const requestData = JSON.parse(data) as RequestData<CustomRequestQuery>;

    if (isExpired(requestData.expire)) {
      logger.trace(`Request #${requestData.id} is expired`);
      return;
    }

    if (BigInt(nowSec() + this.noncePeriod) > BigInt(requestData.expire)) {
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
