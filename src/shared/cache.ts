import { RPC } from '@chainsafe/libp2p-gossipsub/message';
import { Storage } from '../storage/abstract.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('MessagesCache');

/**
 * Cached message type
 */
export interface CachedMessage {
  peerId: string;
  expire: number;
  data: RPC.IMessage;
  nonce: number;
}

/**
 * Cached message entry type
 */
export interface CashedMessageEntry {
  id: string;
  data: RPC.IMessage;
}

/**
 * Messages cache class
 *
 * @export
 * @class MessagesCache
 */
export class MessagesCache {
  protected cache: Storage;

  /**
   * Creates an instance of MessagesCache.
   *
   * @param {Storage} storage
   * @memberof MessagesCache
   */
  constructor(storage: Storage) {
    this.cache = storage;
  }

  /**
   * Deletes expired messages from the cache
   *
   * @returns {Promise<void>}
   * @memberof MessagesCache
   */
  async prune(): Promise<void> {
    const now = Math.ceil(Date.now() / 1000);
    for (const [id, message] of this.cache.entries<CachedMessage>()) {
      if (message.expire < now) {
        await this.cache.delete(id);
      }
    }
  }

  /**
   * Returns message from cache
   *
   * @returns {CashedMessageEntry[]}
   * @memberof MessagesCache
   */
  get(): CashedMessageEntry[] {
    const messages: CashedMessageEntry[] = [];
    for (const [id, entry] of this.cache.entries<CachedMessage>()) {
      messages.push({
        id,
        data: entry.data,
      });
    }
    return messages;
  }

  /**
   * Sets new message to cache
   *
   * @param {string} messageId
   * @param {string} peerId
   * @param {RPC.IMessage} data
   * @param {number} expire
   * @param {number} [nonce=1]
   * @returns {Promise<void>}
   * @memberof MessagesCache
   */
  async set(
    messageId: string,
    peerId: string,
    data: RPC.IMessage,
    expire: number,
    nonce = 1,
  ): Promise<void> {
    try {
      let message = await this.cache.get<CachedMessage>(messageId);
      if (message) {
        if (message.peerId !== peerId) {
          throw new Error(`Invalid message peerId: ${peerId} while expected: ${message.peerId}`);
        }
        if (nonce <= message.nonce) {
          logger.trace('Message ignored: outdated nonce');
          return;
        }
      }
      message = {
        peerId,
        expire,
        data,
        nonce,
      };
      await this.cache.set(messageId, message);
      logger.trace('set:', messageId);
    } catch (error) {
      logger.error(error);
    }
  }
}
