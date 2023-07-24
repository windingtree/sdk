# @windingtree/sdk-storage

The package `@windingtree/sdk-storage` provides a key-value database abstraction layer for Winding Tree SDK. It includes concrete implementations for in-memory storage and browser localStorage. More implementations are expected soon.

## Installation

```bash
pnpm i @windingtree/sdk-storage
```

## Key concepts

- The `Storage` class is an interface for key-value databases. It defines methods for setting, getting, and deleting keys, as well as iterating over all entries.
- The `MemoryStorage` class is an in-memory storage implementation of the `Storage` interface.
- The `LocalStorage` class is a browser localStorage implementation of the `Storage` interface.
- Storage classes include methods to handle storage scope and serialization/deserialization of values.

## Usage

Here is a simplified example of how you can use the `@windingtree/sdk-storage` package:

```typescript
import { memoryStorage, localStorage } from '@windingtree/sdk-storage';

// Create an instance of memory storage
const memStorage = await memoryStorage.createInitializer()();

// Use the storage
await memStorage.set('key1', 'value1');
const value = await memStorage.get('key1'); // 'value1'

// Create an instance of local storage
const localStore = await localStorage.createInitializer()();

// Use the storage
await localStore.set('key2', 'value2');
const value = await localStore.get('key2'); // 'value2'
```

## Documentation

For full documentation and examples, visit [windingtree.github.io/sdk](https://windingtree.github.io/sdk)

## Testing

```bash
pnpm test
```

## Contributing

[Contribution guidelines](https://windingtree.github.io/sdk/#/docs/contribution)
