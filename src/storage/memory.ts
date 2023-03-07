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
export class MemoryStorage<CustomValueType> extends Storage<CustomValueType> {
  private db: Map<string, CustomValueType>;

  constructor(options?: MemoryStorageOptions) {
    super();
    options = MemoryStorageOptionsSchema.parse(options ?? {});
    this.db = new Map<string, CustomValueType>(options?.entries);
    logger.trace('Memory storage initialized');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async set(key: string, value: CustomValueType) {
    this.db.set(key, value);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async get(key: string) {
    return this.db.get(key);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async delete(key: string) {
    return this.db.delete(key);
  }

  entries(): IterableIterator<[string, CustomValueType]> {
    return this.db.entries();
  }
}

// Storage configuration
export const init =
  <CustomStorageOptions extends MemoryStorageOptions>(options?: CustomStorageOptions) =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async <CustomValueType>() => {
    return new MemoryStorage<CustomValueType>(options);
  };
