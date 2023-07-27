# The Protocol Node

## Supplier Configuration

> Before we dive into the supplier configuration, it's important to note that the entity registration/management flow and LIF deposit management are implemented in the node manager example application. For details of implementation, please check the example sources located under the `./examples/manager` directory.

### Owner Credentials

The owner credentials refer to an EOA (Externally Owned Account) or multisig account in the target network. This account is used for various purposes, including:

- Registering the supplier entity in the protocol smart contract.
- Creating or changing the signer account that is dedicated to signing the supplier's offers.
- Managing the LIF (Líf Token) deposit balance.
- Owning the supplier's deal funds.

### Signer Credentials

The signer credentials refer to an EOA that is used for signing offers on behalf of the supplier. The signer is delegated by the owner to perform this task.

### Topics

Topics are tags or sets of tags that depend on the use cases of the supplier's business. For example, if the supplier's business is a hotel, the topic could be the geolocation hash that represents the hotel's address. For abstract services provided without a linkage to geolocation, the topic can be a special unique service code.

The protocol recommends using H3 (Hexagonal hierarchical geospatial indexing system) for representing geolocation-based topics. An example H3 hash looks like this: `87283472bffffff`.

To convert traditional lat/lng coordinates to an H3 hash and vice versa, you can use the `h3` utility from `@windingtree/sdk-utils`.

### Entity Registration

The supplier must register their entity by sending a transaction to the protocol smart contract. The registration function ABI is as follows:

```solidity
function register(
  bytes32 salt,
  address owner,
  address signer,
  uint256 lifDeposit,
  bytes permit
) external;
```

A unique identifier of the supplier will be calculated by the protocol smart contract as a `keccak256` hash of the provided `salt` and the address of the transaction sender.

- The `owner` argument is the address of the supplier entity owner. After registration, this account exclusively will be allowed to change the signer address and manage the LIF token deposit.
- The `signer` argument is the address that is delegated by the `owner` to sign offers.
- The `lifDeposit` argument is the amount of LIF tokens that the `sender` wants to deposit into the account (in WEI). If a zero `lifDeposit` value is provided, the processing of the tokens deposit in this transaction will be skipped.
- The `permit` argument is the EIP-712 signature with the allowance to the contract to spend a proper amount of tokens.

### LIF Deposit Management

LIF deposit management consists of two smart contract functions: one for adding deposits and another for withdrawing deposits.

Adding deposits:

```solidity
function lifDeposit(uint256 amount, bytes permit) external;
```

Deposits withdrawal:

```solidity
function lifDepositWithdraw(uint256 amount) external;
```

These functions can be called by the supplier `owner` only.

## Creating the Node

The node is the main component responsible for handling requests, generating offers, and managing deals. More about the node configuration options can be found [here](./index.md#supplier-node-configuration).

To create a node, you'll need to provide the necessary options, including topics, chain configuration, contracts, server address, supplier ID, and signer credentials.

Here's an example:

```typescript
import { NodeOptions, createNode } from '@windingtree/sdk-node';

const nodeOptions: NodeOptions = {
  topics: ['topic'], // List of topics on which the node listens for incoming requests. You can use H3 geohash as a topic, for example.
  chain: chainConfig, // Blockchain network configuration. See the `Chain` type from `viem/chains`.
  contracts: contractsConfig, // See the `Contracts` type from `@windingtree/type`.
  serverAddress, // Server multiaddr.
  supplierId, // Unique supplier ID that is registered in the protocol smart contract.
  signerSeedPhrase: '<SIGNER_WALLET_SEED_PHRASE>', // Seed phrase for the signer wallet. Used to sign transactions.
  signerPk: signerPk, // Optional. You can provide it instead of signerSeedPhrase.
};

const node = createNode(options);

node.addEventListener('connected', () => {
  console.log('Connected!');
});

node.addEventListener('disconnected', () => {
  console.log('Disconnected!');
});

node.addEventListener('start', () => {
  console.log('Node started');
});

await node.start(); // Start the client
// ...
await node.stop(); // Stop the client
```

## The Node's Events

The node allows subscribing to the following event types:

- `connected`: emitted when the node is connected to the coordination server
- `disconnected`: emitted when the node is disconnected
- `start`: emitted when the node is started
- `stop`: emitted when the node is stopped
- `heartbeat`: emitted every second, useful for performing utility functions
- `message`: emitted on every incoming request

## Subscribing to Requests

When the node starts, it automatically listens for incoming requests on the topics provided in the configuration. Each incoming request leads to a `message` event being emitted. To process these events and handle the incoming requests, you can add a listener for the `message` event.

Here's an example of how to add a request handler by subscribing to the `message` event of the node:

```typescript
node.addEventListener('message', async ({ data }) => {
  console.log(`Got the request #${data.id} with query: ${data.query}`);
  // - Perform validation of the request, such as checking expiration time, query parameters, etc.
  // - Add the request to the processing queue
  // - And more...
});
```

## Queue

For working with deals, it is recommended to use a queue as a scalable solution. The protocol SDK provides such a utility through the `@windingtree/sdk-queue` package.

Here's an example of how to instantiate a queue:

```typescript
import { Queue } from '@windingtree/sdk-queue';
import { memoryStorage } from '@windingtree/sdk-storage';

const queueStorageInit = memoryStorage.createInitializer();

const queue = new Queue({
  storage: await queueStorageInit(),
  hashKey: 'jobs',
  concurrencyLimit: 10,
});
```

Now, we need to properly configure the queue to enable it to handle jobs. We should define a task handler and register it in the queue. Here's how you can complete this:

```typescript
import { JobHandler } from '@windingtree/sdk-queue';

// Creating a handler factory
// We need it because a handler will be initialized dynamically to be able to utilize the runtime environment
const createOfferHandler =
  <JobData = unknown, HandlerOptions = unknown>(
    handler: JobHandler<JobData, HandlerOptions>,
  ) =>
  (options: HandlerOptions = {} as HandlerOptions) =>
  (data: JobData) =>
    handler(data, options);

// Define the type of options that will be injected into the handler scope on every execution
interface DealHandlerOptions {
  contracts: ProtocolContracts; // We have to pass the protocol contracts manager there to be able to make interactions with the protocol smart contracts
  dealsDb: DealsDb; // We also need a database where deals will be stored
}

// Define the deals handler itself
const dealHandler = createOfferHandler<
  OfferData<RequestQuery, OfferOptions>,
  DealHandlerOptions
>(async (offer, options) => {
  // The deals handling source code creation will be reviewed later below

  // Here, you need to take into account:
  // - Returning `false` from the function means that the job must be immediately stopped
  // - Returning `true` will keep the job running
});
```

## Requests Processing

To process incoming requests, the protocol SDK offers the `NodeRequestManager` utility. This tool is designed to handle incoming requests with different `nonce` values and select the latest version of the request after a specific timeout (called `noncePeriod`).

To initialize the `NodeRequestManager`:

```typescript
import { NodeRequestManager } from '@windingtree/sdk-node';

const requestManager = new NodeRequestManager<RequestQuery>({
  noncePeriod: 2000, // 2 seconds
});

// Assuming that the node is already initialized
// We can subscribe to the `message` event and start processing incoming requests

node.addEventListener('message', (e) => {
  const { topic, data } = e.detail;
  // You can add logging of incoming requests here
  requestManager.add(topic, data);
});

// To avoid memory leakage, prune the cache of the requestManager
node.addEventListener('heartbeat', () => {
  requestManager.prune();
});
```

When a `NodeRequestManager` receives a request and the `noncePeriod` is complete, it will emit a `request` event. This event should be used to proceed to the next step of request processing, which involves creating an offer. More details about offer creation will be covered in the next chapter.

## Building and Publishing an Offer

The idea is to generate an offer for every valid and acceptable request. The associated logic should be incorporated into the request queue handler, as explained in the previous chapter.

To build and publish an offer, you can use the `buildOffer` method of the node instance. Here's an example taken from the protocol node example app (located in the `./examples/node` directory of the SDK repository):

```typescript
const offer = await node.buildOffer({
  /** Offer expiration time */
  expire: '15m',
  /** Copy of the request */
  request: detail.data,
  /** Random options data (for testing purposes) */
  options: {
    date: DateTime.now().toISODate(),
    buongiorno: Math.random() < 0.5,
    buonasera: Math.random() < 0.5,
  },
  /**
   * Dummy payment option.
   * In production, these options are managed by the supplier.
   */
  payment: [
    {
      id: randomSalt(),
      price: BigInt('1000000000000000'), // 0.001 LIF
      asset: stableCoins.stable18permit,
    },
    {
      id: randomSalt(),
      price: BigInt('1200000000000000'), // 0.0012 LIF
      asset: stableCoins.stable18,
    },
  ],
  /** Cancellation options */
  cancel: [
    {
      time: BigInt(nowSec() + 500),
      penalty: BigInt(100),
    },
  ],
  /** Check-in and check-out times */
  checkIn: BigInt(nowSec() + 1000),
  checkOut: BigInt(nowSec() + 2000),
});
```

## Working with the Protocol Smart Contract

To interact with the protocol smart contract, you can use the `ProtocolContracts` utility class, which provides methods for managing deals and entities.

```typescript
import { createPublicClient, createWalletClient, http } from 'viem';
import { polygonZkEvmTestnet } from 'viem/chains';
import { ProtocolContracts } from '@windingtree/sdk-contracts-manager';
import { contractsConfig } from './path/to/config';

// Create a public client to interact with the blockchain
const publicClient = createPublicClient({
  chain: polygonZkEvmTestnet,
  transport: http(),
});

// Create a wallet client to sign transactions and interact with the blockchain
const walletClient = createWalletClient({
  chain: polygonZkEvmTestnet,
  transport: http(),
  account: node.signer.address, // Use the signer address from the node configuration
});

// Initialize the ProtocolContracts utility with the necessary configuration
const contractsManager = new ProtocolContracts({
  contracts: contractsConfig, // Configuration for the smart contracts
  publicClient, // Public client instance to interact with the blockchain
  walletClient, // Wallet client instance to sign transactions and interact with the blockchain
});
```

The `ProtocolContracts` class type definition above outlines some of the methods available for interacting with the protocol smart contract. Here are some of the key methods:

**List of Methods:**

- `getDeal`: Fetches deal information from the smart contract.
- `createDeal`: Creates a new deal on offer.
- `cancelDeal`: Cancels a deal.
- `transferDeal`: Transfers a deal to another address.
- `rejectDeal`: Rejects a deal.
- `claimDeal`: Claims a deal.
- `refundDeal`: Refunds a deal.
- `checkInDeal`: Checks-in a deal.
- `checkOutDeal`: Checks-out a deal.
- `registerEntity`: Registers a new entity in the registry.
- `toggleEntity`: Toggles the entity status.
- `changeEntitySigner`: Changes the signer for an entity.
- `addEntityDeposit`: Adds tokens deposit to the entity balance.
- `withdrawEntityDeposit`: Withdraws tokens deposit from the entity balance.
- `getEntity`: Fetches entity information from the registry.
- `balanceOfEntity`: Fetches the balance of an entity deposit.

You can use these methods to perform various actions related to deals and entities on the Winding Tree Market Protocol. For example, you can register a new supplier, create and manage deals, check the balance of a supplier, and withdraw the supplier's LIF tokens.

Keep in mind that interacting with smart contracts involves sending transactions to the blockchain, which may require gas fees. Make sure you have enough funds in the wallet account ([supplier signer account](#signer-credentials)) to cover these fees when performing transactions.

With the `ProtocolContracts` utility, you have a powerful tool to work with the protocol smart contract and manage deals on the Winding Tree Market Protocol.

## Checking Deal State Changes

Tasks for checking deal state changes can be implemented in the same way as monitoring the creation of deals (requests processing). For more details, refer to the previous section on "Requests Processing."

With this information, you have a better understanding of how to configure the supplier node, manage incoming requests, build and publish offers, and handle deal state changes.

## The Node Management API

The protocol SDK includes the `@windingtree/sdk-node-api` package, which provides a powerful tool for remotely managing the node. This tool is based on [tRPC](https://trpc.io/), an end-to-end typesafe RPC framework, and allows for user management, admin management, and deal management procedures.

The `@windingtree/sdk-node-api` package includes the following components:

- **Routers**: These modules define the procedures for user management, admin management, and deal management. Procedures include actions like registration, login, logout, delete, update, check-in, and check-out, among others.
- **Server**: The server module sets up an API server that uses the defined routers to handle requests from clients.
- **Client**: The client module provides utilities for creating EIP-712 signatures for certain operations and middleware functions for tRPC link operations.
- **Constants**: This module exports various constants used across the SDK, such as the access token name and the typed domain for admin signatures.
- **Utils**: This module exports a schema used for pagination in query inputs.

### The Node Management API Instantiation

To set up the node management API, you can use the following example:

```typescript
import { NodeApiServer } from '@windingtree/sdk-node-api/server';
import { appRouter } from '@windingtree/sdk-node-api/router';
import { ProtocolContracts } from '@windingtree/sdk-contracts-manager';
import { memoryStorage } from '@windingtree/sdk-storage';

// Assuming that the `node` and `ProtocolContracts` instances are already initialized

// Set up in-memory storage for users and deals
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
  port: 3000, // Port number for the API server
  secret: 'my-secret', // Secret key for authentication
  ownerAccount: '<Entity_Owner_Address>', // Address of the entity owner
  protocolContracts, // ProtocolContracts instance
});

// Start the API server and set up the defined routers
apiServer.start(appRouter);
```

### Remote Node API Usage

Here's a simple example of how to use the `@windingtree/sdk-node-api/client` in a React application:

```typescript
import { createAdminSignature } from '@windingtree/sdk-node-api/client';
import { useNode, useWallet } from '@windingtree/sdk-react/providers';

// Your code to set up the WindingTree Wallet goes here. Assuming you have a `walletClient` object in the app component.
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

// Call the function to register an admin
handleAdminRegister();
```

With the node management API, you can remotely manage your node by calling the appropriate procedures through the API server. This allows for easy integration and management of users, admins, and deals on the Winding Tree Market Protocol.
