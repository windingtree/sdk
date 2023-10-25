import { Hash } from 'viem';
import { Storage } from '@windingtree/sdk-storage';
import { DealRecord, PaginationOptions } from '@windingtree/sdk-types';
import { createLogger } from '@windingtree/sdk-logger';

const logger = createLogger('DealsDb');

/**
 * Interface defining the properties of a Deal.
 */
// export interface Deal {}

/**
 * Interface defining the properties of DealsDb initialization options.
 */
export interface DealsDbOptions {
  /** Instance of storage used for persisting the state of the API server */
  storage: Storage;
  /** Prefix used for the storage key to avoid potential key collisions */
  prefix: string;
}

/**
 * Class that implements an API to the deals records storage
 *
 * @export
 * @class UsersDb
 */
export class DealsDb {
  /** Storage instance for persisting the state of the API server */
  storage: Storage;
  /** Specific key prefix for the storage key to avoid potential key collisions */
  prefix: string;

  /**
   * Creates an instance of DealsDb.
   * Initializes an instance of DealsDb with given options.
   *
   * @param {UsersDbOptions} options
   * @memberof DealsDb
   */
  constructor(options: DealsDbOptions) {
    const { storage, prefix } = options;

    // TODO Validate DealsDbOptions

    this.prefix = `${prefix}_api_deals_`;
    this.storage = storage;
  }

  /**
   * Adds/Updates the record of the deal in the storage
   *
   * @param {DealRecord} deal The deal object
   * @returns {Promise<void>}
   * @memberof UsersDb
   */
  async set(deal: DealRecord): Promise<void> {
    await this.storage.set<DealRecord>(`${this.prefix}${deal.offer.id}`, deal);
  }

  /**
   * Retrieves the deal from storage.
   *
   * @param {Hash} offerId The Id (offerId) of the deal to be retrieved
   * @returns {Promise<DealRecord>} The deal object associated with the given Id
   * @throws Will throw an error if the user is not found
   * @memberof UsersDb
   */
  async get(offerId: Hash): Promise<DealRecord> {
    const deal = await this.storage.get<DealRecord>(`${this.prefix}${offerId}`);

    if (!deal) {
      throw new Error(`Deal ${offerId} not found`);
    }

    return deal;
  }

  /**
   * Retrieves all the deals from storage.
   *
   * @param {PaginationOptions} [pagination] Pagination options
   * @returns {Promise<DealRecord[]>} Deals records
   * @memberof DealsDb
   */
  getAll(pagination?: PaginationOptions): Promise<DealRecord[]> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      try {
        const page: Required<PaginationOptions> = {
          start: pagination?.start ?? 0,
          skip: pagination?.skip ?? 10,
        };
        let cursor = 0;
        const from = page.start >= 0 ? page.start : 0;
        const to = from + page.skip ?? 0;
        const records: DealRecord[] = [];

        for (const record of await this.storage.entries<DealRecord>()) {
          if (to > 0 && cursor >= from && cursor < to) {
            records.push(record[1]);
          }

          cursor++;
        }

        resolve(records);
      } catch (error) {
        logger.error('getAll', error);
        reject(error);
      }
    });
  }
}
