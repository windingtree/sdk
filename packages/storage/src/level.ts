import {
  GenericStorageOptions,
  Storage,
  StorageInitializerFunction,
} from './abstract.js';
import { ClassicLevel } from 'classic-level';
import { parse, stringify } from 'superjson';
import { IEncoding } from 'level-transcoder';
import { Buffer } from 'buffer';
import { createLogger } from '@windingtree/sdk-logger';

const logger = createLogger('LocalStorage');

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

export class LevelDBStorage extends Storage {
  protected db: ClassicLevel<string, string | string[]>;
  /** Key for storing ids included in the scope */
  scopeIdsKey?: string;

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

  private async getScopeIds(): Promise<Set<string>> {
    if (!this.scopeIdsKey) {
      return new Set();
    }

    const scope = (await this.get(this.scopeIdsKey)) as Iterable<string>;
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
      logger.error('addScopeId', error);
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.db.del(key);
      const isDeleted = (await this.db.get(key)) === null;

      if (isDeleted) {
        await this.deleteScopeId(key);
      }

      return isDeleted;
    } catch (e) {
      return false;
    }
  }

  entries<ValueType = unknown>(): Promise<[[string, ValueType]]> {
    return this.db.iterator().all() as Promise<[[string, ValueType]]>;
  }

  async get<ValueType>(key: string): Promise<ValueType | undefined> {
    try {
      return (await this.db.get(key)) as ValueType;
    } catch (e) {
      logger.error(e);
      return;
    }
  }

  protected a = 0;

  async set<ValueType>(key: string, value: ValueType): Promise<void> {
    await this.db.put(key, value as string | string[]);
    await this.addScopeId(key);
  }

  async reset() {
    await this.db.clear();
  }

  async open() {
    await this.db.open();
  }

  get instance() {
    return this.db;
  }
}

export interface LevelStorageOptions extends GenericStorageOptions {
  scope?: string;
}

export const createInitializer: StorageInitializerFunction<
  LevelDBStorage,
  LevelStorageOptions
> =
  (options) =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async (): Promise<LevelDBStorage> => {
    return new LevelDBStorage(options);
  };
