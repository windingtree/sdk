# @windingtree/sdk-client

This package is a part of the Winding Tree SDK. It provides a set of tools for interacting with the Winding Tree market protocol at a lower level. It primarily handles connections and interactions with the coordination server, including publishing and subscribing to topics, managing connections, and sending and receiving messages. It also offers options for initializing a libp2p instance, managing heartbeats, and handling connection statuses and changes.

## Installation

```bash
pnpm i @windingtree/sdk-client
```

## Usage

Below is a basic example of how to use this package:

```typescript
import { createClient } from '@windingtree/sdk-client';

// Initialize client options
const clientOptions = {
  serverAddress:
    '/ip4/127.0.0.1/tcp/33333/ws/p2p/QmcXbDrzUU5ERqRaronWmAJXwe6c7AEkS7qdcsjgEuWPCf', // Replace with your server address
};

// Create a new client instance
const client = createClient(clientOptions);

// Start the client
client.start().catch(console.error);

// Add event listeners
client.addEventListener('start', () => {
  console.log('Client started');
});

client.addEventListener('stop', () => {
  console.log('Client stopped');
});

client.addEventListener('publish', ({ detail }) => {
  console.log('Request published:', detail);
});

// Publish a request
const requestData = {
  /* Define your request data here */
};
client.publish(requestData);

// Subscribe to a topic
const topic = 'topic_name'; // Replace with your topic name
client.subscribe(topic);

// Stop the client
client.stop().catch(console.error);
```

This will create a new Client instance, start the client, listen for 'start' and 'stop' events, publish a request, subscribe to a topic, and stop the client.

## Documentation

For full documentation and examples, visit [windingtree.github.io/sdk](https://windingtree.github.io/sdk)

## Testing

```bash
pnpm test
```

## Contributing

[Contribution guidelines](https://windingtree.github.io/sdk/#/contribution)
