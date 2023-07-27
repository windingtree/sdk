# @windingtree/sdk-server

The Winding Tree protocol coordination server package. It enables efficient coordination among multiple peers using the libp2p networking stack.

## Installation

```bash
pnpm i @windingtree/sdk-server
```

## Key concepts

This package revolves around setting up a server for facilitating peer-to-peer communication and message exchange in a distributed network. Key components include:

- **CoordinationServer**: A class for creating a coordination server instance, with methods for starting and stopping the server.
- **createServer**: A helper function for instantiating the CoordinationServer class.
- **ServerOptions**: The options type for customizing the coordination server's behavior.

## Usage

```typescript
import { ServerOptions, createServer } from '@windingtree/sdk-server';
import { memoryStorage } from '@windingtree/sdk-storage';

// Define your server options
const options: ServerOptions = {
  port: 33333, // Server port
  peerKey: {...}, // Your peer key in JSON format
  messagesStorageInit: memoryStorage.createInitializer(), // Your messages storage initializer
};

// Create a server
const server = createServer(options);

// Start the server
await server.start();

// Stop the server (e.g. in a shutdown handler)
await server.stop();
```

## Documentation

For full documentation and examples, visit [windingtree.github.io/sdk](https://windingtree.github.io/sdk)

## Testing

```bash
pnpm test
```

## Contributing

[Contribution guidelines](https://windingtree.github.io/sdk/#/docs/contribution)
