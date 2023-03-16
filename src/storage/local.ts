import { z } from 'zod';
import { Storage } from './abstract.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('LocalStorage');

export interface WindowStorage {
  setItem(key: string, value: string): void;
  getItem(key: string): string | null;
  removeItem(key: string): void;
  key(index: number): string | null;
  length: number;
}

// Storage options
export const LocalStorageOptionsSchema = z.object({
  session: z.boolean().default(false),
});

export type LocalStorageOptions = z.infer<typeof LocalStorageOptionsSchema>;

// In-memory key-value storage implementation
export class LocalStorage extends Storage {
  db: WindowStorage;

  constructor(options?: LocalStorageOptions) {
    super();
    options = LocalStorageOptionsSchema.parse(options ?? {});
    this.db = options.session ? sessionStorage : localStorage;
    logger.trace('Local storage initialized');
  }

  serialize<ValueType>(value: ValueType) {
    return JSON.stringify(value);
  }

  deserialize<ValueType>(value: string) {
    return JSON.parse(value) as ValueType;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async set<ValueType>(key: string, value: ValueType) {
    this.db.setItem(key, this.serialize(value));
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async get<ValueType>(key: string) {
    const value = this.db.getItem(key);
    if (value !== null) {
      return this.deserialize<ValueType>(value);
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async delete(key: string) {
    this.db.removeItem(key);
    return this.db.getItem(key) === null;
  }

  entries<ValueType>(): IterableIterator<[string, ValueType]> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const source = this;

    function* entriesIterator(): IterableIterator<[string, ValueType]> {
      let index = 0;

      while (index < source.db.length) {
        const key = source.db.key(index++);

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
}

// Storage configuration
export const init =
  (options?: LocalStorageOptions) =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async (): Promise<LocalStorage> => {
    return new LocalStorage(options);
  };
