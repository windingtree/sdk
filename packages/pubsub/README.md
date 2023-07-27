# @windingtree/sdk-pubsub

This package provides a centralized publish/subscribe protocol (`CenterSub`) for peer-to-peer communication within a WindingTree network, built on top of the `libp2p-gossipsub` protocol.

## Installation

```bash
pnpm i @windingtree/sdk-pubsub
```

## Key concepts

This library introduces a custom PubSub protocol (`CenterSub`) for the WindingTree network. It is based on the GossipSub protocol from the ChainSafe library but modifies certain aspects to adapt to a centralized system.

The key concepts in this library include:

1. `CenterSub`: The main class that extends `GossipSub` and modifies it to suit a centralized PubSub model.

2. `MessagesCache`: A class used to manage and manipulate a cache of messages that are currently being processed by the network.

3. `MessageTransformer`: A user-defined function to parse and process incoming messages.

4. `handlePeerConnect`, `onAddPeer`, `onRemovePeer`, `onHandleReceivedMessage`, `onSelectPeersToPublish`: Overridden GossipSub methods to adapt the protocol to the centralized model.

## Usage

This package is primarily used to manage the PubSub protocol for a WindingTree network. An instance of the `CenterSub` class can be created and used for message broadcasting and handling.

```typescript
import { createLibp2p } from 'libp2p';
import { CenterSubOptions, centerSub } from '@windingtree/sdk-pubsub';

const options: CenterSubOptions = {
  isClient: true,
  directPeers: [...],
  messageTransformer: (message: ArrayBuffer) => {
    // parse and process the message
    return JSON.parse(decodeText(message)) as GenericMessage;
  },
  messagesStorage: new Storage(),
};

const createCenterSubInstance = centerSub(options);

this.libp2p = await createLibp2p({
  transports: [...],
  streamMuxers: [...],
  connectionEncryption: [...],
  services: {
    pubsub: centerSub({ // <-- Using CenterSub as pubsub service
      isClient: true,
      directPeers: [
        {
          id: /* serverPeerId */,
          addrs: [/* serverMultiaddr */],
        },
      ],
    }),
  },
  connectionManager: {...},
);
```

## Documentation

For full documentation and examples, visit [windingtree.github.io/sdk](https://windingtree.github.io/sdk)

## Testing

```bash
pnpm test
```

## Contributing

[Contribution guidelines](https://windingtree.github.io/sdk/#/docs/contribution)
