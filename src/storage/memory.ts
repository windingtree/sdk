import { z } from 'zod';
import { Storage } from './abstract.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('MemoryStorage');

// Storage options
export const MemoryStorageOptionsSchema = z.object({
  entries: z.array(z.tuple([z.string(), z.any()])).optional(),
});

export type MemoryStorageOptions = z.infer<typeof MemoryStorageOptionsSchema>;

// In-memory key-value storage implementation
export class MemoryStorage extends Storage {
  private db: Map<string, unknown>;

  constructor(options?: MemoryStorageOptions) {
    super();
    options = MemoryStorageOptionsSchema.parse(options ?? {});
    this.db = new Map<string, unknown>(options?.entries);
    logger.trace('Memory storage initialized');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async set<ValueType>(key: string, value: ValueType) {
    this.db.set(key, value);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async get<ValueType>(key: string) {
    return this.db.get(key) as ValueType;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async delete(key: string) {
    return this.db.delete(key);
  }

  entries<ValueType>(): IterableIterator<[string, ValueType]> {
    return this.db.entries() as IterableIterator<[string, ValueType]>;
  }
}

// Storage configuration
export const init =
  (options?: MemoryStorageOptions) =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async (): Promise<MemoryStorage> => {
    return new MemoryStorage(options);
  };
