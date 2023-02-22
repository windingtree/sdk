# Coordination server

## Create the server

More about the server configuration options is [here](./index.md#coordination-server).

```typescript
import { ServerOptions, createServer } from '@windingtree/sdk';

const options: ServerOptions = {
  /*...*/
};

const server = createServer(options);
await server.start(); // Start the server
await server.stop(); // Stop the server
```
