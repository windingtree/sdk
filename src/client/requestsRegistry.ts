import { EventEmitter, CustomEvent } from '@libp2p/interfaces/events';
import { Client } from '../index.js';
import { GenericQuery } from '../common/messages.js';
import { Request, RawRequest } from '../common/request.js';
import { Storage } from '../storage/index.js';
import { createLogger } from '../utils/logger.js';
import { CenterSub } from '../common/pubsub.js';

const logger = createLogger('RequestsRegistry');

export interface RequestEvents<CustomRequestQuery extends GenericQuery> {
  /**
   * @example
   *
   * ```js
   * request.addEventListener('change', () => {
   *    // ... registry updated
   * })
   * ```
   */
  change: CustomEvent<Required<Request<CustomRequestQuery>>[]>;
}

// Requests manager
export class RequestsRegistry<CustomRequestQuery extends GenericQuery> extends EventEmitter<
  RequestEvents<CustomRequestQuery>
> {
  private requests: Map<string, Request<CustomRequestQuery>>; // id => Request
  private client: Client<CustomRequestQuery>;
  private storage?: Storage<RawRequest<CustomRequestQuery>[]>;
  private storageKey: string;

  constructor(
    client: Client<CustomRequestQuery>,
    storage: Storage<RawRequest<CustomRequestQuery>[]>,
    prefix = 'requestsRegistry',
  ) {
    super();

    if (!(client instanceof Client)) {
      throw new Error('Invalid client reference');
    }
    this.client = client;
    this.requests = new Map<string, Request<CustomRequestQuery>>();
    this.storageKey = `${prefix}_records`;
    this.storage = storage;
    this._storageUp().catch(logger.error);
  }

  private emitChange(): void {
    this.dispatchEvent(
      new CustomEvent<Required<Request<CustomRequestQuery>>[]>('change', {
        detail: this.getAll(),
      }),
    );
  }

  private async _storageUp(): Promise<void> {
    if (!this.storage) {
      throw new Error('Invalid requests registry storage');
    }

    const rawRecords = await this.storage.get(this.storageKey);

    if (rawRecords) {
      if (!this.client.libp2p) {
        throw new Error('libp2p not initialized yet');
      }

      for (const record of rawRecords) {
        try {
          const request = new Request({
            pubsub: this.client.libp2p.pubsub as CenterSub,
            querySchema: this.client.querySchema,
          });
          await request.buildRaw(record);

          if (!request.data) {
            throw new Error('Invalid request');
          }

          this.requests.set(request.data.id, request);
        } catch (error) {
          logger.error(error);
        }
      }
    }

    this.emitChange();
  }

  private _storageDown(): void {
    if (!this.storage) {
      throw new Error('Invalid requests registry storage');
    }

    const records = [];

    for (const record of this.requests.values()) {
      records.push(record.toRaw());
    }

    this.storage.set(this.storageKey, records).catch(logger.error);
    this.emitChange();
  }

  set(request: Request<CustomRequestQuery>) {
    if (!request.data || !request.data.id) {
      throw new Error('Invalid request');
    }

    request.addEventListener('changed', () => {
      this._storageDown();
    });
    request.addEventListener(
      'expired',
      () => {
        this.emitChange();
      },
      { once: true },
    );

    this.requests.set(request.data.id, request);
    this._storageDown();
  }

  get(id: string): Request<CustomRequestQuery> | undefined {
    return this.requests.get(id);
  }

  getAll(): Required<Request<CustomRequestQuery>>[] {
    return Array.from(this.requests.values()) as Required<Request<CustomRequestQuery>>[];
  }

  delete(id: string): boolean {
    const result = this.requests.delete(id);

    if (result) {
      this._storageDown();
    }

    return result;
  }

  clear() {
    this.requests.clear();
    this._storageDown();
  }
}
