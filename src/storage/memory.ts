import { Storage, StorageInitializer } from './index.js';

// In-memory key-value storage implementation
export class MemoryStorage<CustomValueType> implements Storage<CustomValueType> {
  private db: Map<string, CustomValueType> = new Map();

  async set(key: string, value: CustomValueType) {
    this.db.set(key, value);
  }

  async get(key: string) {
    return this.db.get(key);
  }

  async delete(key: string) {
    return this.db.delete(key);
  }

  entries(): IterableIterator<[string, CustomValueType]> {
    return this.db.entries();
  }
}

// Storage initializer
export const initStorage: StorageInitializer = async <CustomValueType>() => {
  return new MemoryStorage<CustomValueType>();
};
