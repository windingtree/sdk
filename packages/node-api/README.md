# @windingtree/sdk-node-api

The WindingTree market protocol node API server and client. This SDK provides a client and server implementation for communication with the WindingTree Market Protocol Node. This API allows to implement the protocol node management. For the implementation detail please see [the node manager app example](../../examples/manager/).

## Installation

```bash
pnpm i @windingtree/sdk-node-api
```

## Key concepts

This SDK is designed to work with the WindingTree Market Protocol and includes several core components:

- **Routers**: These modules define the procedures for user management, admin management, and deal management. Procedures include registration, login, logout, delete, update, checkIn, and checkOut actions, among others.
- **Server**: The server module sets up an API server that uses the defined routers to handle requests.
- **Client**: The client module provides utilities for creating EIP-712 signatures for certain operations and middleware functions for tRPC link operations.
- **Constants**: This module exports various constants used across the SDK, such as the access token name and the typed domain for admin signature.
- **Utils**: This module exports a schema used for pagination in query inputs.

## Usage

The package exports a NodeApiServer class that can be used to set up an API server that interacts with the WindingTree Market Protocol. The server uses tRPC, an end-to-end typesafe RPC framework, allowing for easy interaction with clients.

```typescript
import { NodeApiServer } from '@windingtree/sdk-node-api/server';
import { appRouter } from '@windingtree/sdk-node-api/router';
import { ProtocolContracts } from '@windingtree/sdk-contracts-manager';
import { memoryStorage } from '@windingtree/sdk-storage';

// Initialize your ProtocolContracts, Node, and other components here...
const contractsManager = new ProtocolContracts({...});

const usersStorage = await memoryStorage.createInitializer({
  scope: 'users',
})();
const dealsStorage = await memoryStorage.createInitializer({
  scope: 'deals',
})();

const apiServer = new NodeApiServer({
  usersStorage,
  dealsStorage,
  prefix: 'my-prefix',
  port: 3000,
  secret: 'my-secret',
  ownerAccount: entityOwnerAddress,
  protocolContracts: contractsManager,
});

apiServer.start(appRouter);

// Handle incoming requests and perform necessary actions here...
```

Here's a simple example (React) of using the `@windingtree/sdk-node-api/client`:

```typescript
import { createAdminSignature } from '@windingtree/sdk-node-api/client';
import { useNode, useWallet } from '@windingtree/sdk-react/providers';

// Your code to setup the WindingTree Wallet goes here. Assuming you have a `walletClient` object in the app component.
const { walletClient } = useWallet();
const { node } = useNode();

const handleAdminRegister = async (name: string) => {
  try {
    const signature = await createAdminSignature(walletClient);

    await node.admin.register.mutate({
      login: name,
      password: signature,
    });
  } catch (error) {
    console.error('Error admin register:', error);
  }
};

handleAdminRegister();
```

## Documentation

For full documentation and examples, visit [windingtree.github.io/sdk](https://windingtree.github.io/sdk)

## Testing

```bash
pnpm test
```

## Contributing

[Contribution guidelines](https://windingtree.github.io/sdk/#/docs/contribution)
