# Coordination Server

## Creating the Server

> You can find the complete code for a server implementation example in the SDK repository under the `./examples/server` directory.

## Configuration

Below is an example of the configuration and implementation for the protocol coordination server.

To instantiate the server, you need to generate a peer key. The process of key generation is explained in detail [here](/#peer-key-generation).

```typescript
import { ServerOptions } from '@windingtree/sdk-server';
import { memoryStorage } from '@windingtree/sdk-storage';
import { serverPeerKey } from './path/to/config.js';

const options: ServerOptions = {
  port: 33333,
  peerKey: serverPeerKey,
  /**
   * This example uses MemoryStorage,
   * but in production, it is recommended to use Redis.
   **/
  messagesStorageInit: memoryStorage.createInitializer(),
};
```

For caching requests (clients' requests and suppliers' offers), the server uses storage. In this configuration example, we use the `memoryStorage` implementation offered by the SDK library. However, in your system, you are free to implement your own storage layer. For details, please see the [storage documentation](./storage.md).

To create the server, you can use the `createServer` function from the `@windingtree/sdk-server` library, passing in the `options` object defined earlier.

```typescript
import { createServer } from '@windingtree/sdk-server';

// Using the `options` from the example above
const server = createServer(options);

server.addEventListener('start', () => {
  console.log('🚀 Server started');
});

server.addEventListener('stop', () => {
  console.log('👋 Server stopped');
});

await server.start(); // Start the server

// ...
await server.stop(); // Stop the server
```

Once the server is started, it begins accepting connections from clients and supplier nodes and efficiently coordinates messages between them to facilitate seamless interactions within the protocol ecosystem.
