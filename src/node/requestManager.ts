import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import { RequestData, GenericQuery } from '../shared/types.js';
import { NoncePeriodOption } from '../shared/options.js';
import { isExpired, nowSec, parseSeconds } from '../utils/time.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('NodeRequestManager');

/**
 * Type for initialization options of the request manager in the protocol node.
 */
export type NodeRequestManagerOptions = NoncePeriodOption;

/**
 * Type for custom event for request
 */
export interface RequestEvent<CustomRequestQuery extends GenericQuery> {
  topic: string;
  data: RequestData<CustomRequestQuery>;
}

/**
 * Type of request item in the cache
 */
interface RequestCacheItem<CustomRequestQuery extends GenericQuery> {
  topic: string;
  data: RequestData<CustomRequestQuery>;
}

/**
 * NodeRequestManager events interface
 */
export interface NodeRequestManagerEvents<
  CustomRequestQuery extends GenericQuery,
> {
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

  /**
   * @example
   *
   * ```js
   * request.addEventListener('request', () => {
   *    // ... request is ready
   * })
   * ```
   */
  error: CustomEvent<Error>;
}

/**
 * Class for managing requests in a node
 *
 * @export
 * @class NodeRequestManager
 * @extends {EventEmitter<NodeRequestManagerEvents<CustomRequestQuery>>}
 * @template CustomRequestQuery
 */
export class NodeRequestManager<
  CustomRequestQuery extends GenericQuery = GenericQuery,
> extends EventEmitter<NodeRequestManagerEvents<CustomRequestQuery>> {
  /** The period of time the manager waits for messages with a higher nonce. */
  private noncePeriod: number;
  /** In-memory cache for messages. */
  private cache: Map<string, RequestCacheItem<CustomRequestQuery>>;

  /**
   * Creates an instance of NodeRequestManager.
   * @param {NodeRequestManagerOptions} options
   * @memberof NodeRequestManager
   */
  constructor(options: NodeRequestManagerOptions) {
    super();

    const { noncePeriod } = options;

    // @todo Validate NodeRequestManagerOptions

    // requestId => RequestCacheItem
    this.cache = new Map<string, RequestCacheItem<CustomRequestQuery>>();

    this.noncePeriod = Number(parseSeconds(noncePeriod));
  }

  /**
   * Sets a new value of the `noncePeriod`
   *
   * @param {(number | string)} noncePeriod
   * @memberof NodeRequestManager
   */
  setNoncePeriod(noncePeriod: number | string) {
    this.noncePeriod = Number(parseSeconds(noncePeriod));
  }

  /**
   * Adds a request to cache
   *
   * @param {string} requestTopic
   * @param {string} data
   * @memberof NodeRequestManager
   */
  add(requestTopic: string, data: string) {
    try {
      const requestData = JSON.parse(data) as RequestData<CustomRequestQuery>;

      // TODO: Implement validation of `data` type and `requestTopic`

      // Check if request is expired
      if (isExpired(requestData.expire)) {
        logger.trace(`Request #${requestData.id} is expired`);
        return;
      }

      // Check if request will expire before it can be processed
      if (nowSec() + this.noncePeriod > Number(requestData.expire)) {
        logger.trace(
          `Request #${requestData.id} will expire before it can bee processed`,
        );
        return;
      }

      // If request is new, add to cache and set a timeout to dispatch event
      if (!this.cache.has(requestData.id)) {
        // New request
        this.cache.set(requestData.id, {
          data: requestData,
          topic: requestTopic,
        });

        // Wait until the nonce period ends
        setTimeout(() => {
          try {
            const cacheItem = this.cache.get(requestData.id);

            if (cacheItem) {
              this.dispatchEvent(
                new CustomEvent('request', {
                  detail: {
                    topic: cacheItem.topic,
                    data: cacheItem.data,
                  },
                }),
              );

              if (!this.cache.delete(requestData.id)) {
                throw new Error(
                  `Unable to remove request #${requestData.id} from cache`,
                );
              }
            }
          } catch (error) {
            logger.error(error);
          }
        }, this.noncePeriod * 1000);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const { topic, data } = this.cache.get(requestData.id)!;

        // If request is known, only update if nonce is higher and the same topic
        if (requestTopic === topic && requestData.nonce > data.nonce) {
          this.cache.set(requestData.id, { data: requestData, topic });
        }
      }
    } catch (error) {
      logger.error(error);
      this.dispatchEvent(
        new CustomEvent('error', {
          detail: new Error('Unable to add request to cache due to error'),
        }),
      );
    }
  }

  /**
   * Clears the requests cache
   *
   * @memberof NodeRequestManager
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Deletes expired requests from the cache
   *
   * @memberof NodeRequestManager
   */
  prune() {
    for (const [id, record] of this.cache.entries()) {
      try {
        if (isExpired(record.data.expire)) {
          this.cache.delete(id);
        }
      } catch (error) {
        logger.error('Cache prune error', error);
      }
    }
  }
}
