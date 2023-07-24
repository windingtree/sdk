# @windingtree/sdk-node

This package provides a complete and customizable Winding Tree node, suitable for suppliers. It offers functionalities for managing offers and requests, as well as built-in connection and reconnection logic to the marketplace server. The Node class provides an easy way to handle all interactions with the Winding Tree marketplace.

## Installation

```bash
pnpm i @windingtree/sdk-node
```

## Key Concepts

- **Node:** A Node represents a supplier in the Winding Tree network. It is capable of sending offers and handling requests.
- **Libp2p:** Libp2p is a modular network stack that allows you to build your own peer-to-peer applications. The Node uses it for all network communications.
- **Peer-to-Peer Communication:** Offers and requests are transmitted using a peer-to-peer (P2P) network, meaning they're sent directly between nodes.
- **Signer:** The signer is responsible for signing offers with an Ethereum account to ensure the authenticity of the offer.

## Usage

Below is an example of how to instantiate and use a Node:

```typescript
import { createNode, NodeEvents } from '@windingtree/sdk-node';
import { OfferData } from '@windingtree/sdk-types';
import { polygonZkEvmTestnet } from 'viem/chains';

const node = createNode({
  topics: ['myTopic'],
  supplierId: 'mySupplierId',
  signerSeedPhrase: 'mySeedPhrase',
  chain: polygonZkEvmTestnet,
  contracts: { ...contractsConfig },
  serverAddress:
    '/ip4/127.0.0.1/tcp/33333/ws/p2p/QmcXbDrzUU5ERqRaronWmAJXwe6c7AEkS7qdcsjgEuWPCf', // Change to your server address
});

node.addEventListener<NodeEvents['connected']>('connected', () => {
  console.log('Node is connected.');
});

node.addEventListener<NodeEvents['message']>('message', ({ detail }) => {
  console.log('Received message:', detail);
});

await node.start();
```

## API

- **createNode(options: NodeOptions):** Creates a new Node instance. Options should include the server address, supplierId, topics, and the signer account details.
- **Node.start():** Starts the Node instance.
- **Node.stop():** Stops the Node instance.
- **Node.connected:** Boolean property that indicates whether the Node is connected.
- **Node.makeOffer(offerOptions):** Creates, signs, and publishes an offer. Returns the offer.
- **Node.handleRequest(event):** Handles a request event.
- **Node.enable():** Enables the Node instance, allowing it to start listening to configured topics.
- **Node.disable():** Disables the Node instance, causing it to stop listening to all configured topics.

The Node class also emits several events, including 'start', 'stop', 'connected', 'disconnected', 'heartbeat', and 'message'. You can add event listeners for these events to react to changes in the Node's state.

## Documentation

For full documentation and examples, visit [windingtree.github.io/sdk](https://windingtree.github.io/sdk)

## Contributing

[Contribution guidelines](https://windingtree.github.io/sdk/#/docs/contribution)

## Testing

```bash
pnpm test
```
