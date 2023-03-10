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
export class LocalStorage<CustomValueType> extends Storage<CustomValueType> {
  db: WindowStorage;

  constructor(options?: LocalStorageOptions) {
    super();
    options = LocalStorageOptionsSchema.parse(options ?? {});
    this.db = options.session ? sessionStorage : localStorage;
    logger.trace('Local storage initialized');
  }

  serialize(value: CustomValueType) {
    return JSON.stringify(value);
  }

  deserialize(value: string) {
    return JSON.parse(value) as CustomValueType;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async set(key: string, value: CustomValueType) {
    this.db.setItem(key, this.serialize(value));
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async get(key: string) {
    const value = this.db.getItem(key);
    if (value !== null) {
      return this.deserialize(value);
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async delete(key: string) {
    this.db.removeItem(key);
    return this.db.getItem(key) === null;
  }

  entries(): IterableIterator<[string, CustomValueType]> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const source = this;

    function* entriesIterator(): IterableIterator<[string, CustomValueType]> {
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
  <CustomStorageOptions extends LocalStorageOptions>(options?: CustomStorageOptions) =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async <CustomValueType>(): Promise<LocalStorage<CustomValueType>> => {
    return new LocalStorage<CustomValueType>(options);
  };
