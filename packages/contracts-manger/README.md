# @windingtree/sdk-contracts-manager

This package is a core component of the Winding Tree SDK. It provides an interface to interact with smart contracts, allowing developers to execute various operations including transactions and contract function calls.

The `ProtocolContracts` class exposed by this package contains methods to interact with smart contracts for entities such as offers and deals. These methods support functionalities like creating, fetching, and cancelling deals, registering entities, and handling various deal statuses (checking-in, checking-out, rejecting, claiming, and refunding).

## Installation

```bash
pnpm i @windingtree/sdk-contracts-manager
```

## Key Concepts

- `PublicClient` and `WalletClient` are used for blockchain interactions. A `PublicClient` is used for reading blockchain state and data, while a `WalletClient` is used for writing transactions to the blockchain.
- The `_sendHelper` method is a private utility used to send transactions to the blockchain network.
- The `TxCallback` is a type definition for a callback function that will be called with the transaction hash when a transaction is sent.
- The methods in the `ProtocolContracts` class follow a pattern where they accept the parameters necessary for the specific blockchain operation, an optional `WalletClient` to specify the signer of the transaction, and an optional `TxCallback` that will be called with the transaction hash.

## Usage

```typescript
import { createPublicClient, createWalletClient, http } from 'viem';
import { polygonZkEvmTestnet } from 'viem/chains';
import { ProtocolContracts } from '@windingtree/sdk-contracts-manager';

// Instantiate with options
const protocolContracts = new ProtocolContracts({
  contracts: {
    /* contracts configuration */
  },
  publicClient: createPublicClient({
    chain: polygonZkEvmTestnet,
    transport: http(),
  }),
  walletClient: createWalletClient({
    chain: polygonZkEvmTestnet,
    transport: http(),
    account: node.signer.address,
  }),
});

// Use methods to interact with the blockchain
protocolContracts.createDeal(/* parameters */);
protocolContracts.getDeal(/* parameters */);
// and other methods...
```

## Documentation

For full documentation and examples, visit [windingtree.github.io/sdk](https://windingtree.github.io/sdk)

## Testing

```bash
pnpm test
```

## Contributing

[Contribution guidelines](https://windingtree.github.io/sdk/#/docs/contribution)
