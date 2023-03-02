import { RPC } from '@chainsafe/libp2p-gossipsub/message';
import { z } from 'zod';
import { Storage } from '../storage/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('MessagesCache');

export const CachedMessageSchema = z.object({});

export interface CachedMessage {
  peerId: string;
  expire: number;
  data: RPC.IMessage;
  nonce: number;
}

export interface CashedMessageEntry {
  id: string;
  data: RPC.IMessage;
}

export class MessagesCache {
  protected cache: Storage<CachedMessage>;

  constructor(storage: Storage<CachedMessage>) {
    this.cache = storage;
  }

  prune(): void {
    const now = Math.ceil(Date.now() / 1000);
    for (const [id, message] of this.cache.entries()) {
      if (message.expire < now) {
        this.cache.delete(id);
      }
    }
  }

  async get(): Promise<CashedMessageEntry[]> {
    const messages: CashedMessageEntry[] = [];
    for (const [id, entry] of this.cache.entries()) {
      messages.push({
        id,
        data: entry.data,
      });
    }
    return messages;
  }

  async set(messageId: string, peerId: string, data: RPC.IMessage, expire: number, nonce = 1): Promise<void> {
    try {
      let message = await this.cache.get(messageId);
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
      this.cache.set(messageId, message);
      logger.trace('set:', messageId);
    } catch (error) {
      logger.error(error);
    }
  }
}
