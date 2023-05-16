# Coordination server

## Create the server

More about the server configuration options is [here](./index.md#coordination-server).

```typescript
import { ServerOptions, createServer, storage } from '@windingtree/sdk';

const options: ServerOptions = {
  messagesStorageInit: storage['YOUR_STORAGE_OPTION']
    .createInitializer
    /** Your storage configuration */
    (),
  /** Other server configuration options */
};

const server = createServer(options);

server.addEventListener('start', () => {
  logger.trace('🚀 Server started at', new Date().toISOString());
});

server.addEventListener('stop', () => {
  logger.trace('👋 Server stopped at:', new Date().toISOString());
});

await server.start(); // Start the server
await server.stop(); // Stop the server
```
