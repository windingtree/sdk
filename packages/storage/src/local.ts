import { stringify, parse } from 'superjson';
import {
  GenericStorageOptions,
  Storage,
  StorageInitializerFunction,
} from './abstract.js';
import { createLogger } from '@windingtree/sdk-logger';

const logger = createLogger('LocalStorage');

/**
 * Generic localStorage interface
 */
export interface WindowStorage {
  setItem(key: string, value: string): void;
  getItem(key: string): string | null;
  removeItem(key: string): void;
  key(index: number): string | null;
  length: number;
}

/**
 * Local storage options type
 */
export interface LocalStorageOptions extends GenericStorageOptions {
  session?: boolean;
}

/**
 * In-memory key-value storage implementation
 *
 * @class LocalStorage
 * @extends {Storage}
 */
export class LocalStorage extends Storage {
  db: WindowStorage;
  scopeIdsKey?: string;
  /**
   * Queue of pending storage operations to prevent concurrent data modifications.
   * @private
   * @type {(() => Promise<void>)[]}
   */
  private operationQueue: (() => Promise<void>)[] = [];

  /**
   * Creates an instance of LocalStorage.
   *
   * @param {LocalStorageOptions} [options]
   * @memberof LocalStorage
   */
  constructor(options?: LocalStorageOptions) {
    super();
    options = options ?? {};

    // @todo Validate LocalStorageOptions

    this.db = options.session ? sessionStorage : localStorage;

    if (options.scope) {
      this.scopeIdsKey = `local_storage_scope_${options.scope}_ids`;
    }

    logger.trace('Local storage initialized');
  }

  /**
   * Processes the queue of operations
   */
  private async processQueue(): Promise<void> {
    while (this.operationQueue.length > 0) {
      const operation = this.operationQueue.shift();
      if (operation) {
        try {
          await operation();
        } catch (error) {
          logger.error('processQueue', error);
        }
      }
    }
  }

  /**
   * Enqueues an operation to be executed
   * @param {() => Promise<void>} operation - An async operation to be executed
   */
  private enqueueOperation(operation: () => Promise<void>) {
    this.operationQueue.push(operation);
    if (this.operationQueue.length === 1) {
      this.processQueue().catch(logger.error);
    }
  }

  /**
   * Serializes a value
   *
   * @template ValueType
   * @param {ValueType} value
   * @returns {string}
   * @memberof LocalStorage
   */
  private serialize<ValueType>(value: ValueType): string {
    return stringify(value);
  }
  /**
   * Deserializes a value
   *
   * @template ValueType
   * @param {string} value
   * @returns {ValueType}
   * @memberof LocalStorage
   */
  private deserialize<ValueType>(value: string): ValueType {
    return parse<ValueType>(value);
  }

  private getScopeIds(): Set<string> {
    if (!this.scopeIdsKey) {
      return new Set();
    }

    return new Set(
      this.deserialize<string[]>(this.db.getItem(this.scopeIdsKey) ?? '[]'),
    );
  }

  private saveScopeIds(ids: Set<string>) {
    if (!this.scopeIdsKey) {
      return;
    }

    this.db.setItem(this.scopeIdsKey, this.serialize(Array.from(ids)));
  }

  private addScopeId(id: string) {
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
   * Sets a key-value pair in the storage
   * @template ValueType
   * @param {string} key - The key to set
   * @param {ValueType} value - The value to set
   */
  async set<ValueType>(key: string, value: ValueType) {
    return new Promise<void>((resolve) => {
      // eslint-disable-next-line @typescript-eslint/require-await
      this.enqueueOperation(async () => {
        this.db.setItem(key, this.serialize(value));
        this.addScopeId(key);
        resolve();
      });
    });
  }

  /**
   * Gets a key from the storage
   *
   * @template ValueType
   * @param {string} key
   * @returns {Promise<ValueType | undefined>}
   * @memberof LocalStorage
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async get<ValueType>(key: string): Promise<ValueType | undefined> {
    const value = this.db.getItem(key);

    if (value !== null) {
      return this.deserialize<ValueType>(value);
    }

    return;
  }

  /**
   * Deletes a key from the storage
   * @param {string} key - The key to delete
   * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating if the operation was successful
   */
  async delete(key: string): Promise<boolean> {
    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/require-await
      this.enqueueOperation(async () => {
        const keyExists = this.db.getItem(key);
        if (!keyExists) {
          resolve(false);
          return;
        }
        this.db.removeItem(key);
        const isDeleted = this.db.getItem(key) === null;
        if (isDeleted) {
          this.deleteScopeId(key);
        }
        resolve(isDeleted);
      });
    });
  }

  /**
   * Returns the storage entries iterator
   *
   * @template ValueType
   * @returns {IterableIterator<[string, ValueType]>}
   * @memberof LocalStorage
   */
  entries<ValueType>(): IterableIterator<[string, ValueType]> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const source = this;
    const scopeEnabled = Boolean(this.scopeIdsKey);
    const ids = this.getScopeIds();

    function* entriesIterator(): IterableIterator<[string, ValueType]> {
      let index = 0;

      while (index < source.db.length) {
        const key = source.db.key(index++);

        if (scopeEnabled && key && !ids.has(key)) {
          continue;
        }

        if (key === null) {
          return;
        }

        const value = source.db.getItem(key);

        if (!value) {
          return;
        }

        yield [key, source.deserialize(value)];
      }
    }

    return entriesIterator();
  }

  close(): Promise<void> {
    return Promise.resolve(undefined);
  }

  open(): Promise<void> {
    return Promise.resolve(undefined);
  }
}

/**
 * Local storage configuration
 */
export const createInitializer: StorageInitializerFunction<
  LocalStorage,
  LocalStorageOptions
> =
  (options) =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async (): Promise<LocalStorage> => {
    return new LocalStorage(options);
  };
