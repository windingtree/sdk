import {
  GenericStorageOptions,
  Storage,
  StorageInitializerFunction,
} from './abstract.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('MemoryStorage');

/**
 * Memory storage options type
 */
export interface MemoryStorageOptions extends GenericStorageOptions {
  entries?: Array<[string, unknown]>;
}

/**
 * In-memory key-value storage implementation
 *
 * @class MemoryStorage
 * @extends {Storage}
 */
export class MemoryStorage extends Storage {
  /** Map as in-memory key-value storage */
  private db: Map<string, unknown>;
  /** Key for storing ids included in the scope */
  scopeIdsKey?: string;

  /**
   * Creates an instance of MemoryStorage.
   *
   * @param {MemoryStorageOptions} [options]
   * @memberof MemoryStorage
   */
  constructor(options?: MemoryStorageOptions) {
    super();
    options = options ?? {};

    // Validate MemoryStorageOptions

    if (options.scope) {
      this.scopeIdsKey = `memory_storage_scope_${options.scope}_ids`;
    }

    this.db = new Map<string, unknown>(options?.entries);

    if (options.entries) {
      options.entries.forEach((e) => {
        this.addScopeId(e[0]);
      });
    }

    logger.trace('Memory storage initialized');
  }

  /**
   * Retrieves Ids from scope
   *
   * @private
   * @returns {Set<string>}
   * @memberof MemoryStorage
   */
  private getScopeIds(): Set<string> {
    if (!this.scopeIdsKey) {
      return new Set<string>();
    }

    return (this.db.get(this.scopeIdsKey) as Set<string>) ?? new Set<string>();
  }

  /**
   * Saves Ids to scope
   *
   * @private
   * @param {Set<string>} ids
   * @returns
   * @memberof MemoryStorage
   */
  private saveScopeIds(ids: Set<string>) {
    if (!this.scopeIdsKey) {
      return;
    }

    this.db.set(this.scopeIdsKey, ids);
  }

  /**
   * Adds Id to scope
   *
   * @private
   * @param {string} id
   * @returns
   * @memberof MemoryStorage
   */
  protected addScopeId(id: string) {
    try {
      if (!this.scopeIdsKey) {
        return;
      }

      const ids = this.getScopeIds();
      ids.add(id);
      this.saveScopeIds(ids);
    } catch (error) {
      logger.error('addScopeId', error);
    }
  }

  /**
   * Deletes Id from scope
   *
   * @private
   * @param {string} id
   * @returns
   * @memberof MemoryStorage
   */
  private deleteScopeId(id: string) {
    try {
      if (!this.scopeIdsKey) {
        return;
      }

      const ids = this.getScopeIds();
      ids.delete(id);
      this.saveScopeIds(ids);
    } catch (error) {
      logger.error('addScopeId', error);
    }
  }

  /**
   * Resets the db
   *
   * @internal
   *
   * @template ValueType
   * @memberof MemoryStorage
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async reset<ValueType>() {
    this.db = new Map<string, ValueType>();
  }

  /**
   * Sets the key to the storage
   *
   * @template ValueType
   * @param {string} key
   * @param {ValueType} value
   * @memberof MemoryStorage
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async set<ValueType>(key: string, value: ValueType) {
    this.db.set(key, value);
    this.addScopeId(key);
  }

  /**
   * Gets the key from the storage
   *
   * @template ValueType
   * @param {string} key
   * @returns {Promise<ValueType>}
   * @memberof MemoryStorage
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async get<ValueType>(key: string): Promise<ValueType> {
    return this.db.get(key) as ValueType;
  }

  /**
   * Deletes the key
   *
   * @param {string} key
   * @returns
   * @memberof MemoryStorage
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async delete(key: string) {
    const isDeleted = this.db.delete(key);

    if (isDeleted) {
      this.deleteScopeId(key);
    }

    return isDeleted;
  }

  /**
   * Returns the storage entries iterator
   *
   * @template ValueType
   * @returns {IterableIterator<[string, ValueType]>}
   * @memberof MemoryStorage
   */
  entries<ValueType>(): IterableIterator<[string, ValueType]> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const source = this;
    const scopeEnabled = Boolean(this.scopeIdsKey);
    const ids = Array.from(this.getScopeIds());

    function* entriesIterator(): IterableIterator<[string, ValueType]> {
      let index = 0;

      while (index < source.db.size) {
        const key = ids[index++];

        if (!key) {
          return;
        }

        const value = source.db.get(key) as ValueType | undefined;

        if (!value) {
          return;
        }

        yield [key, value];
      }
    }

    return scopeEnabled
      ? entriesIterator()
      : (this.db.entries() as IterableIterator<[string, ValueType]>);
  }
}

// Storage configuration
export const createInitializer: StorageInitializerFunction<MemoryStorage> =
  (options?: MemoryStorageOptions) =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async (): Promise<MemoryStorage> => {
    return new MemoryStorage(options);
  };
