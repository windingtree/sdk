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
type ServerOptions = {
  /** Peer key in JSON format */
  peerKey: {
    id: string;
    privKey: string;
    pubKey: string;
  };
  /** Server port */
  port: number;
  /** Messages storage initializer */
  messagesStorageInit: (...args: unknown[]) => Promise<Storage>;
  /** Optional IP address of the server, defaults to '0.0.0.0' */
  address?: string | undefined;
};
```

Here is an example of the coordination server configuration:

```typescript
import { ServerOptions, storage } from '@windingtree/sdk';
import { peerKey } from './config.js';

const options: ServerOptions = {
  address: '0.0.0.0',
  port: 33333,
  peerKey,
  messagesStorageInit: storage.memoryStorage.init(),
};
```

### Supplier node

A base options type definitions:

```typescript
type NodeOptions<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> = {
  /** Period while the node waits and accepting requests with the same Id */
  noncePeriod: number;
  /** The protocol smart contract configuration */
  contractConfig: {
    address: string;
    name: string;
    version: string;
    chainId: string | number | bigint;
  };
  /** Multiaddr of the coordination server */
  serverAddress: string;
  /** Seed phrase of the node signer wallet */
  signerSeedPhrase: string;
  /** Subscription topics of node */
  topics: string[];
  /** Unique supplier Id */
  supplierId: string;
  /** Query validation schema */
  querySchema: ZodType<CustomRequestQuery>;
  /** Offer options validation schema instance */
  offerOptionsSchema: ZodType<CustomOfferOptions>;
  /** Ethers.js provider instance */
  provider?: AbstractProvider | undefined;
  /** Additional Libp2p initialization options */
  libp2p?: Libp2pOptions | undefined;
};
```

Here is an example of a supplier node configuration:

```typescript
import { NodeOptions } from '@windingtree/sdk';
import { latLngToCell } from '@windingtree/sdk/utils';
import {
  RequestQuerySchema,
  OfferOptionsSchema,
  RequestQuery,
  OfferOptions,
  supplierId,
  signerSeedPhrase,
  coordinates,
} from './config.js';

const options: NodeOptions<RequestQuery, OfferOptions> = {
  querySchema: RequestQuerySchema, // zod schema
  offerOptionsSchema: OfferOptionsSchema, // zod schema
  topics: ['hello', latLngToCell(coordinates)],
  contractConfig: {
    name: 'WtMarket',
    version: '1',
    chainId: '1',
    address: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
  },
  serverAddress: '/ip4/127.0.0.1/tcp/33333/ws/p2p/QmcXbDr...jgEuWPCf',
  noncePeriod: 5,
  supplierId,
  signerSeedPhrase,
};
```

### Client node

```typescript
type ClientOptionsClientOptions<
  CustomRequestQuery extends GenericQuery,
  CustomOfferOptions extends GenericOfferOptions,
> = {
  /** The protocol smart contract configuration */
  contractConfig: {
    address: string;
    name: string;
    version: string;
    chainId: string | number | bigint;
  };
  /** Multiaddr of the coordination server */
  serverAddress: string;
  /** Query validation schema */
  querySchema: ZodType<CustomRequestQuery>;
  /** Offer options validation schema instance */
  offerOptionsSchema: ZodType<CustomOfferOptions>;
  /** Client key-value storage initializer */
  storageInitializer: (...args: unknown[]) => Promise<Storage>;
  /** Request registry keys prefix */
  requestRegistryPrefix: string;
  /** Ethers.js provider instance */
  provider?: AbstractProvider | undefined;
  /** Additional Libp2p initialization options */
  libp2p?: Libp2pOptions | undefined;
};
```

Here is an example of a client configuration:

```typescript
import { Wallet } from 'ethers';
import { ClientOptions, storage } from '@windingtree/sdk';
import { RequestQuerySchema, OfferOptionsSchema, RequestQuery, OfferOptions } from './config.js';

const options: ClientOptions<RequestQuery, OfferOptions> = {
  querySchema: RequestQuerySchema,
  offerOptionsSchema: OfferOptionsSchema,
  contractConfig: {
    name: 'WtMarket',
    version: '1',
    chainId: '1',
    address: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
  },
  serverAddress: '/ip4/127.0.0.1/tcp/33333/ws/p2p/QmcXbDr...jgEuWPCf',
  storageInitializer: storage.localStorage.init({
    session: true,
  }),
  requestRegistryPrefix: 'requestsRegistry',
};
```

## SDK development

- WindingTree Discord server, [developers channel](https://discord.com/channels/898350336069218334/956614058323370014)
- Bug tracker: [https://github.com/windingtree/sdk/issues](https://github.com/windingtree/sdk/issues)
- [Contribution](/docs/contribution.md)
