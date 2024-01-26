import {
  GenericStorageOptions,
  Storage,
  StorageInitializerFunction,
} from './abstract.js';
import { ClassicLevel } from 'classic-level';
import { stringify, parse } from 'superjson';
import { IEncoding } from 'level-transcoder';
import { Buffer } from 'buffer';
import { createLogger } from '@windingtree/sdk-logger';

const logger = createLogger('LevelDBStorage');

const superJsonEncoding: IEncoding<
  string | string[],
  Uint8Array,
  string | string[]
> = {
  encode: (data: string | string[]) => Buffer.from(stringify(data)),
  decode: (data: Uint8Array) => parse(data.toString()),
  format: 'buffer',
  name: 'super-json-encoding',
};

export interface LevelStorageOptions extends GenericStorageOptions {
  path?: string;
}

/**
 * LevelDB based key-value storage implementation
 *
 * @class LevelDBStorage
 * @extends {Storage}
 */
export class LevelDBStorage extends Storage {
  protected db: ClassicLevel<string, string | string[]>;
  /** Key for storing ids included in the scope */
  scopeIdsKey?: string;

  /**
   * Queue for managing database operations to prevent concurrent access issues.
   * @private
   * @type {(() => Promise<void>)[]}
   */
  private operationQueue: (() => Promise<void>)[] = [];

  /**
   * Creates an instance of LevelDBStorage.
   *
   * @param {LevelStorageOptions} [options]
   * @memberof LevelDBStorage
   */
  constructor(options?: LevelStorageOptions) {
    super();

    options = options ?? {};

    const dbPath = options.path || './db';

    this.db = new ClassicLevel<string, string | string[]>(dbPath, {
      keyEncoding: 'utf8',
      valueEncoding: superJsonEncoding,
      createIfMissing: true,
      errorIfExists: false,
    });

    if (options.scope) {
      this.scopeIdsKey = `level_storage_scope_${options.scope}_ids`;
    }

    logger.trace('LevelDB storage initialized');
  }

  /**
   * Processes the operation queue. Ensures operations are executed one after the other.
   * @private
   * @returns {Promise<void>}
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
   * Enqueues an operation and starts processing if it's the only operation in the queue.
   * @private
   * @param {() => Promise<void>} operation - The operation to enqueue and execute.
   */
  private enqueueOperation(operation: () => Promise<void>) {
    this.operationQueue.push(operation);
    if (this.operationQueue.length === 1) {
      this.processQueue().catch(logger.error);
    }
  }

  private async getScopeIds(): Promise<Set<string>> {
    if (!this.scopeIdsKey) {
      return new Set();
    }

    const scope = (await this.get<string[]>(this.scopeIdsKey)) ?? [];
    return new Set(scope);
  }

  private async saveScopeIds(ids: Set<string>) {
    if (!this.scopeIdsKey) {
      return;
    }

    await this.db.put(this.scopeIdsKey, Array.from(ids));
  }

  private async addScopeId(id: string) {
    try {
      if (!this.scopeIdsKey) {
        return;
      }

      const ids = await this.getScopeIds();
      ids.add(id);
      await this.saveScopeIds(ids);
    } catch (error) {
      logger.error('addScopeId', error);
    }
  }

  private async deleteScopeId(id: string) {
    try {
      if (!this.scopeIdsKey) {
        return;
      }

      const ids = await this.getScopeIds();
      ids.delete(id);
      await this.saveScopeIds(ids);
    } catch (error) {
      logger.error('deleteScopeId', error);
    }
  }

  /**
   * Deletes the key from the storage.
   * Enqueues the delete operation to ensure sequential execution.
   * @param {string} key - The key to delete.
   * @returns {Promise<boolean>}
   */
  async delete(key: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.enqueueOperation(async () => {
        try {
          const keyExists = await this.db
            .get(key)
            .then(() => true)
            .catch(() => false);
          if (!keyExists) {
            resolve(false);
            return;
          }
          await this.db.del(key);
          await this.deleteScopeId(key);
          resolve(true);
        } catch (error) {
          logger.error('Error in delete operation', error);
          reject(
            new Error(
              `Delete filed: ${key}: ${
                (error as Error).message ?? 'Unknown delete error'
              }`,
            ),
          );
        }
      });
    });
  }

  /**
   * Returns all entries in the storage as an array of [key, value] pairs
   *
   * @template ValueType
   * @returns {Promise<[string, ValueType][]>}
   * @memberof LevelDBStorage
   */
  async entries<ValueType>(): Promise<[string, ValueType][]> {
    const scopeEnabled = Boolean(this.scopeIdsKey);
    const ids = await this.getScopeIds();
    const entries: [string, ValueType][] = [];

    for await (const [key, value] of this.db.iterator<string, ValueType>({})) {
      if (scopeEnabled && this.scopeIdsKey && !ids.has(key)) {
        continue;
      }

      entries.push([key, value]);
    }

    return entries;
  }

  /**
   * Retrieves the value associated with the given key
   *
   * @template ValueType
   * @param {string} key
   * @returns {Promise<ValueType | undefined>}
   * @memberof LevelDBStorage
   */
  async get<ValueType>(key: string): Promise<ValueType | undefined> {
    try {
      return (await this.db.get(key)) as ValueType;
    } catch (e) {
      logger.error('get', e);
      return;
    }
  }

  /**
   * Sets the value for the given key in the storage.
   * Enqueues the operation to ensure sequential execution.
   * @template ValueType
   * @param {string} key - The key to set the value for.
   * @param {ValueType} value - The value to set.
   * @returns {Promise<void>}
   */
  async set<ValueType>(key: string, value: ValueType): Promise<void> {
    return new Promise((resolve, reject) => {
      this.enqueueOperation(async () => {
        try {
          await this.db.put(key, value as string | string[]);
          await this.addScopeId(key);
          resolve();
        } catch (error) {
          logger.error('Error in set operation', error);
          reject(
            new Error(
              `Set failed ${key}: ${
                (error as Error).message ?? 'Unknown set error'
              }`,
            ),
          );
        }
      });
    });
  }

  /**
   * Clears all data from the storage
   *
   * @memberof LevelDBStorage
   */
  async reset() {
    await this.db.clear();
  }

  /**
   * Opens the LevelDB storage
   *
   * @memberof LevelDBStorage
   */
  async open() {
    await this.db.open();
  }

  /**
   * Returns the LevelDB instance
   *
   * @readonly
   * @memberof LevelDBStorage
   */
  get instance() {
    return this.db;
  }
}

export const createInitializer: StorageInitializerFunction<
  LevelDBStorage,
  LevelStorageOptions
  // eslint-disable-next-line @typescript-eslint/require-await
> = (options) => async (): Promise<LevelDBStorage> => {
  return new LevelDBStorage(options);
};
