# Protocol storage

The WindingTree market protocol SDK was developed as a cross-platform solution. Because of that storage layer was designed as a database-agnostic and allows using of different platform-specific key-value of type databases.

## Abstract storage API

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

## Storage usage

Every storage connector has `createInitializer` function that is a factory that returns async storage initializer function.

```typescript
type StorageInitializer = () => Promise<Storage>;

type StorageInitializerFunction = (
  options?: GenericStorageOptions,
) => StorageInitializer;
```

```typescript
import { storage } from '@windingtree/sdk';

const storageInit = storage.{'memoryStorage' | 'localStorage'}.createInitializer(
  /** initializer options: configuration, password, etc... */
);

/** Somewhere in the app */
const stor = await storageInit();

await stor.set('key', 'value');
await stor.get('key');
// -> 'value'
for (const entry of stor.entries()) {
  console.log(`key: "${entry[0]}", value: "${entry[1]}"`);
}
// -> key: "key", value: "value"
```

## Storage connectors

- `MemoryStorage`: Simple in-memory storage
- `LocalStorage`: In-browser local/session storage
- `IndexedDB`: tbd
- `Redis`: tbd
- `LevelDb`: tbd

## Storage options

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

## How to create own storage connector

Here is a simple connector template:

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

If your database requires graceful shutdown it is recommended to include this logic right inside the initializer.

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
