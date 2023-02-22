# Welcome

> SDK is in beta. Libraries may be unstable and APIs are subject to change.

The WindingTree Market Protocol is dedicated to the coordination and deal management between buyers and sellers. The SDK includes software tools required to set up and build the protocol actors and implement its workflow. To know how the protocol works please follow the [link](/docs/protocol.md).

## Protocol addresses

- Coordination server: `SERVER_MULTIADDR`
- Bridge contract #1 (`CHAIN`): `BRIDGE_ADDRESS`
- ...Bridge contract #n...
- Smart contract (`CHAIN`): `CONTRACT_ADDRESS`

## Protocol assets

List of assets that can be bridged to L3 and used for deals making

- `ASSET_NAME` #1 (`CHAIN`): `ASSET_ADDRESS`
- ...`ASSET_NAME` #n (`CHAIN`): `ASSET_ADDRESS`...

...

## Setup

```bash
yarn add @windingtree/sdk ethers
```

## Configuration

## Peer key generation

The peer key is part of p2p security schema. It uses for peer identification and establishing secured connections between peers.

```typescript
import { generatePeerKey } from '@windingtree.sdk';

await generatePeerKey();
/*
{
  "id": "QmTu1X88PUpazc1Mf6bN77t43K1AA2nnKL1JnHwMiPmgfB",
  "privKey": "CAASp...3xt0ZZWcAhpq0A=",
  "pubKey": "CAASpgI...MBAAE="
}
*/
```

### Coordination server

```typescript
interface NodeKeyJson {
  id: string; // Peer Id
  privKey: string; // Private key
  pubKey: string; // Public key
}

// Storage initializer configuration options
interface StorageOptions {
  engine(options?: StorageEngineOptions): void; // A storage engine initialization callback
  options?: Record<string, unknown>; // Optional storage initialization options
}

// Peer configuration options
interface PeerOptions {
  peerKey?: NodeKeyJson; // Peer key
}

interface ServerOptions extends PeerOptions {
  address?: string; // Optional IP address of the server, defaults to '0.0.0.0'
  port: number; // libp2p listening port
  storage?: StorageOptions; // Optional the servers' data storage
}
```

> `storage` is optional. If this option is not provided the server will fall back to in-memory storage. This is not recommended in production.

Here is an example of the coordination server configuration:

```typescript
import { ServerOptions, redisStorage } from '@windingtree/sdk';
import { peerKey } from './config.js';

const options: ServerOptions = {
  address: '0.0.0.0',
  port: 33333,
  storage: {
    engine: redisStorage,
  },
  peerKey,
};
```

### Supplier node

A base options type definitions:

```typescript
interface NetworkOptions {
  chainId: number; // Target network chainId
  rpc: string; // Target network  RPC
  contract: string; // The protocol smart contract address (on target network)
}

interface RequestQueueOptions {
  repeat: number; // Number of retries before the failing task will be marked as failed
}

// Coordination server client configuration
interface ServerClientOptions {
  serverAddress?: string; // The coordination server multiaddr. If not provided for a client node the address will be obtained from the smart contract
}

interface NodeOptions extends PeerOptions, ServerClientOptions {
  chains: NetworkOptions[]; // Supported chains
  storage?: StorageOptions; // Optional the nodes' data storage
  signer: Wallet; // Ethers.js Wallet instance
  subjects?: string[]; // Subjects for subscription
  requestQueue?: RequestQueueOptions; // Request queue configuration
}
```

Here is an example of a supplier node configuration:

```typescript
import { Wallet } from 'ethers';
import { NodeOptions, redisStorage } from '@windingtree/sdk';
import { latLngToCell } from '@windingtree/sdk/utils';
import { signerPrivateKey, peerKey, coordinates } from './config.js';

const options: NodeOptions = {
  chains: [
    {
      chainId: 000,
      rpc: 'https://RpcUri',
      contract: '0x1dfe9Ca09e99d10833Bf73044a23B73Fc20523DF',
    },
  ],
  serverAddress: '/ip4/127.0.0.1/tcp/33333/ws/p2p/QmcXbDrzUU5ERqRaronWmAJXwe6c7AEkS7qdcsjgEuWPCf',
  peerKey,
  storage: {
    engine: redisStorage,
  },
  signer: new Wallet(signerPrivateKey),
  subjects: [latLngToCell(coordinates.lat, coordinates.lng)],
  requestQueue: {
    repeat: 3,
  },
};
```

### Client node

```typescript
interface BridgeOptions {
  name: string;
  income: {
    chainId: number;
    address: string; // source smart contract address
  };
  outcome: {
    chainId: number;
    address: string; // destination smart contract address
  };
}

interface ClientOptions extends PeerOptions, ServerClientOptions {
  chains: NetworkOptions[]; // Supported chains
  bridges?: BridgeOptions[]; // Optional assets bridges configuration
  storage?: StorageOptions; // Optional data storage configuration
  wallet?: Wallet; // Optional wallet configuration. Make sense in the `electron.js` environment
}
```

Here is an example of a client configuration:

```typescript
import { Wallet } from 'ethers';
import { ClientOptions, clientLocalStorage } from '@windingtree/sdk';
import { serializationFunction } from './utils.js';
import { walletPrivateKey } from './config.js';

const options: ClientOptions = {
  chains: [
    {
      chainId: 000,
      rpc: 'https://RpcUri',
      contract: '0x1dfe9Ca09e99d10833Bf73044a23B73Fc20523DF',
    },
  ],
  serverAddress: '/ip4/127.0.0.1/tcp/33333/ws/p2p/QmcXbDrzUU5ERqRaronWmAJXwe6c7AEkS7qdcsjgEuWPCf',
  bridges: [
    {
      name: 'polygon',
      income: {
        chainId: 137,
        address: '0x5771449C72ED80f28b3bE3a962Bf7E88adFA58bd',
      },
      outcome: {
        chainId: 000,
        address: '0xbf3db410a05b3864a45074713150779b5b99880e',
      },
    },
  ],
  storage: {
    engine: clientLocalStorage,
    options: {
      prefix: '_client',
      serialize: serializationFunction,
    },
  },
  wallet: new Wallet(walletPrivateKey),
};
```

> In the browser environment the `wallet` configuration is not required. In the browser the client will automatically select a connected wallet (e.q. MetaMask, WalletConnect, etc).

## SDK development

- WindingTree Discord server, developers channel: <LINK_TO_DISCORD_SERVER>
- Proposals: <LINK_TO_PROPOSALS_SITE>
- Bug tracker: <LINK_TO_GITHUB_ISSUES>
- [Contribution](/docs/contribution.md)
