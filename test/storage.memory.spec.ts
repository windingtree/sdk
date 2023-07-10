import { describe, expect, it, beforeEach } from './setup.js';
import {
  MemoryStorage,
  MemoryStorageOptions,
  createInitializer,
} from '../src/storage/memory.js';

describe('MemoryStorage', () => {
  let memoryStorage: MemoryStorage;

  beforeEach(() => {
    const options: MemoryStorageOptions = {
      scope: 'test',
      entries: [['test', 'value']],
    };
    memoryStorage = new MemoryStorage(options);
  });

  describe('#constructor', () => {
    it('MemoryStorage is initialized correctly', () => {
      expect(memoryStorage).toBeDefined();
      expect(memoryStorage).toBeInstanceOf(MemoryStorage);
    });

    it('Throws an error when a non-string key is used in the initial entries', () => {
      const badOptions: MemoryStorageOptions = {
        entries: {} as Array<[string, unknown]>,
      };
      expect(() => new MemoryStorage(badOptions)).toThrow(TypeError);
    });
  });

  describe('#set', () => {
    it('Value is set correctly', async () => {
      await memoryStorage.set('testKey', 'testValue');
      const result = await memoryStorage.get('testKey');
      expect(result).toEqual('testValue');
    });
  });

  describe('#get', () => {
    it('Value is retrieved correctly', async () => {
      const result = await memoryStorage.get('test');
      expect(result).toEqual('value');
    });

    it('Returns undefined when a non-existing key is used', async () => {
      const result = await memoryStorage.get('nonExistingKey');
      expect(result).toBeUndefined();
    });

    it('Throws an error when a non-string key is used', async () => {
      const result = await memoryStorage.get(undefined as unknown as string);
      expect(result).toBeUndefined();
    });
  });

  describe('#delete', () => {
    it('Value is deleted correctly', async () => {
      await memoryStorage.delete('test');
      const result = await memoryStorage.get('test');
      expect(result).toBeUndefined();
    });

    it('Returns false when a non-existing key is used', async () => {
      const result = await memoryStorage.delete('nonExistingKey');
      expect(result).toBeFalsy();
    });
  });

  describe('#entries', () => {
    it('Entries are retrieved correctly', () => {
      const entries = Array.from(memoryStorage.entries<string>());
      expect(entries).toContainEqual(['test', 'value']);
    });

    it('Returns an empty iterator when storage is empty', async () => {
      await memoryStorage.reset();
      const entries = Array.from(memoryStorage.entries<string>());
      expect(entries.length).toEqual(0);
    });
  });

  describe('#reset', () => {
    it('Storage is reset correctly', async () => {
      await memoryStorage.reset<string>();
      const result = await memoryStorage.get('test');
      expect(result).toBeUndefined();
      const entries = Array.from(memoryStorage.entries<string>());
      expect(entries.length).toEqual(0);
    });
  });

  describe('#createInitializer', () => {
    it('Initializer creates instance correctly', async () => {
      const options: MemoryStorageOptions = { scope: 'testInitializer' };
      const initializer = createInitializer(options);
      const initializedStorage = await initializer();
      expect(initializedStorage).toBeInstanceOf(MemoryStorage);
      expect(initializedStorage.scopeIdsKey).toEqual(
        'memory_storage_scope_testInitializer_ids',
      );
    });
  });
});
