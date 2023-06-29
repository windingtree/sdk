import { Hash } from 'viem';
import { Storage } from '../../storage/index.js';
import { DealRecord, PaginationOptions } from '../../shared/types.js';
import { createLogger } from '../../utils/logger.js';

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
  async getAll(pagination?: PaginationOptions): Promise<DealRecord[]> {
    return new Promise((resolve, reject) => {
      try {
        pagination = pagination ?? {
          start: 0,
          skip: 10,
        };
        let cursor = 0;
        const from = pagination.start >= 0 ? pagination.start : 0;
        const to = from + pagination.skip ?? 0;
        const records: DealRecord[] = [];

        for (const record of this.storage.entries<DealRecord>()) {
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
