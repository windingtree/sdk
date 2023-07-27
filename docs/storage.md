# Protocol Storage

The WindingTree market protocol SDK was developed as a cross-platform solution, and as a result, the storage layer was designed to be database-agnostic, allowing the use of different platform-specific key-value databases.

## Abstract Storage API

The SDK provides an abstract `Storage` class with the following methods:

```typescript
abstract class Storage {
  abstract set<CustomValueType = unknown>(
    key: string,
    value: CustomValueType,
  ): Promise<void>;
  abstract get<CustomValueType = unknown>(
    key: string,
  ): Promise<CustomValueType | undefined>;
  abstract delete(key: string): Promise<boolean>;
  abstract entries<CustomValueType = unknown>(): IterableIterator<
    [string, CustomValueType]
  >;
}
```

## Storage Usage

To use the storage layer, you can choose from various storage connectors provided by the SDK, such as `memoryStorage` and `localStorage`. Each storage connector has a `createInitializer` function that acts as a factory, returning an async storage initializer function.

Here's an example of how to use `memoryStorage`:

```typescript
import { memoryStorage } from '@windingtree/sdk-storage';

const storageInit = memoryStorage.createInitializer();

/** Somewhere in the app */
const stor = await storageInit();

await stor.set('key', 'value');
await stor.get('key'); // -> 'value'
for (const entry of stor.entries()) {
  console.log(`key: "${entry[0]}", value: "${entry[1]}"`);
  // -> key: "key", value: "value"
}
```

## Storage Connectors

The SDK provides several storage connectors, each serving different purposes:

- `MemoryStorage`: A simple in-memory storage connector.
- `LocalStorage`: A storage connector for in-browser local or session storage.
- `IndexedDB`: A storage connector for using IndexedDB (to be implemented).
- `Redis`: A storage connector for using Redis (to be implemented).
- `LevelDB`: A storage connector for using LevelDB (to be implemented).

### MemoryStorage

```typescript
type MemoryStorageOptions = {
  /** Pre-fill entries */
  entries?: [string, any][];
};
```

### LocalStorage

```typescript
type LocalStorageOptions = {
  /** local OR session storage */
  session?: boolean;
};
```

## Creating Your Own Storage Connector

If you have a specific database or storage system in mind, you can create your own storage connector by extending the `Storage` class and implementing its abstract methods.

Here's a simple template for creating your own storage connector:

```typescript
import { Storage, StorageInitializerFunction } from '@windingtree/sdk';
import { createLogger } from '@windingtree/sdk/utils';

const logger = createLogger('MyStorage');

/**
 * My storage options type
 */
export interface MyStorageOptions {
  login: string;
  password: string;
}

/**
 * My storage class
 *
 * @class MyStorage
 * @extends {Storage}
 */
export class MyStorage extends Storage {
  /**
   * Creates an instance of MyStorage.
   *
   * @param {MyStorageOptions} [options]
   * @memberof MyStorage
   */
  constructor(options?: MyStorageOptions) {
    super();
    /**
     * - Validate options
     * - Constructor logic
     **/
    logger.trace('My storage initialized');
  }

  /**
   * My storage interface implementation
   */
}

export const createInitializer: StorageInitializerFunction =
  (options?: MyStorageOptions) =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async (): Promise<MyStorage> => {
    return new MyStorage(options);
  };
```

If your database requires graceful shutdown, it is recommended to include this logic right inside the initializer function:

```typescript
export const createInitializer: StorageInitializerFunction =
  (options?: MyStorageOptions) =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async (): Promise<MyStorage> => {
    const stor = new MyStorage(options);

    /**
     * Graceful database shutdown handler
     */
    const shutdown = () => {
      const stopHandler = async () => {
        await stor.stop();
      };
      stopHandler()
        .catch((error) => {
          logger.trace(error);
          process.exit(1);
        })
        .finally(() => process.exit(0));
    };

    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);

    return stor;
  };
```

By following this template, you can create a custom storage connector tailored to your specific database or storage system.
