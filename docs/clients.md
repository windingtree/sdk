# The Protocol Clients

The protocol clients can be implemented as web browsers, React Native applications, or server-side Node.js applications. The SDK repository includes a comprehensive client implementation example within a React application, available under the `./examples/client` directory.

This client example application offers support for the following features:

- Requests creation and publishing
- Accepting offers
- Deals creation
- Deals cancellation
- Tracking deals state
- Check-in deals

Below, you will find guidelines for essential parts of the application example, which will provide you with a better understanding of the protocol client features and usage principles.

## Configuration and Start

To handle requests and deals, it is recommended to utilize the `ClientRequestsManager` and `ClientDealsManager` classes provided by the SDK. Before configuring either class, we must create storages that will be utilized for the persistence of requests and deals.

```typescript
import { localStorage } from '@windingtree/sdk-storage';

const storageInitializer = localStorage.createInitializer({
  session: false, // session or local storage
});

const store = await storageInitializer();
```

Next, we need to create industry-specific TypeScript types for the requests data that will be sent by the client and types for offer options (which comes with an offer) that it can expect as well. This is required for a better developer experience and to help avoid type errors during code creation. For type consistency, they must be extended from basic generic types that can be imported from the SDK package.

```typescript
import { GenericQuery, GenericOfferOptions } from '@windingtree/sdk-types';

export interface RequestQuery extends GenericQuery {
  greeting: string; // This is a very simple request, just for testing
}

export interface OfferOptions extends GenericOfferOptions {
  date?: string;
  buongiorno: boolean; // Yes, we expect that a supplier may propose us a good day
  buonasera: boolean; // or a good evening
}
```

The last missed configuration option we need is `contractsConfig` that contains information about the protocol smart contracts' addresses.

Here is a basic TypeScript type that explains the structure of a `contractsConfig` option.

```typescript
interface ContractConfig {
  /** Smart contract name */
  name: string;
  /** Internal smart contract version */
  version: string;
  /** Smart contract address */
  address: Address;
}
/**
 * The protocol smart contract set configuration
 */
interface Contracts {
  /** The protocol configuration smart contract */
  config: ContractConfig;
  /** The protocol entities registry smart contract */
  entities: ContractConfig;
  /** The protocol market smart contract */
  market: ContractConfig;
  /** The protocol utility token */
  token: ContractConfig;
}
```

If in your application you are going to use the protocol smart contracts that are already deployed by the SDK team, you have to refer to [this information](./index.md#smart-contract-instances).

Here is how your `contractsConfig` can look like:

```json
{
  "config": {
    "name": "Config",
    "version": "1",
    "address": "0x098b1d12cAfE7315C77b6d308A62ce02806260Ee"
  },
  "entities": {
    "name": "EntitiesRegistry",
    "version": "1",
    "address": "0x4bB51528C83844b509E1152EEb05260eE1bf60e6"
  },
  "market": {
    "name": "Market",
    "version": "1",
    "address": "0xDd5B6ffB3585E109ECddec5293e31cdc1e9DeD57"
  },
  "token": {
    "name": "LifToken",
    "version": "1",
    "address": "0x4d60F4483BaA654CdAF1c5734D9E6B16735efCF8"
  }
}
```

Now we are able to instantiate managers.

```typescript
import { ClientRequestsManager, ClientDealsManager } from '@windingtree/sdk-client';
import { polygonZkEvmTestnet } from 'viem/chains';

const requestsManager = new ClientRequestsManager<
  RequestQuery,
  OfferOptions
>({
  storage: store,
  prefix: 'wt_requests_', // This prefix will be added to the key in localStorage to avoid key collision
});

const dealsManager = new ClientDealsManager<
  RequestQuery,
  OfferOptions
>({
  storage: store,
  prefix: 'wt_deals_',
  checkInterval: '5s', // Interval for deal state change check
  chain: polygonZkEvmTestnet, // Target blockchain network we will use
  contracts: contractsConfig,
  publicClient, // See https://viem.sh/docs/clients/public.html
});
```

Assuming that you already know the `serverAddress` that has been generated during the protocol coordination [server configuration step](./coordinator.md).

Below, we are instantiating the protocol client and subscribing to available system events to implement the behavior of our application.

A client allows subscribing to the following event types.

- `start`: emitted when the client is started
- `stop`: emitted when the client is stopped
- `connected`: emitted when the client is connected to the coordination server
- `disconnected`: emitted when the client is disconnected
- `heartbeat`: emitted every second, useful for performing utility functions

`requestsManager` events scope:

- `create`: emitted when a request is created
- `publish`: emitted when a request is published
- `subscribe`: emitted when a request is subscribed to offers
- `unsubscribe`: emitted when a request is unsubscribed
- `expire`: emitted when a request expires
- `cancel`: emitted when a request is canceled
- `delete`: emitted when a request is deleted from registry
- `offer`: emitted when offer on a request is received
- `clear`: emitted when the request registry is cleared

```typescript
import { createClient } from '@windingtree/sdk-client';
import { serverAddress } from './path/to/config.js';

const client = createClient<RequestQuery, OfferOptions>({
  serverAddress,
});

/**
 * Here we need to create a bunch of event-related handlers
 * that will implement the behavior of our application:
 *
 * - onClientStart
 * - onClientStop
 * - onClientConnected
 * - onClientDisconnected
 * - onRequestPublish
 * - onOffer
 * - updateRequests
 * - onRequestSubscribe
 * - onRequestUnsubscribe
 * - updateDeals
 */

const onRequestPublish = ({ detail }) => {
  requestsManager.add(detail);
};

const onOffer = ({ detail }) => {
  requestsManager.addOffer(detail);
};

// ... other handlers

client.addEventListener('start', onClientStart);
client.addEventListener('stop', onClientStop);
client.addEventListener('connected', onClientConnected);
client.addEventListener('disconnected', onClientDisconnected);
client.addEventListener('publish', onRequestPublish);
client.addEventListener('offer', onOffer);

requestsManager.addEventListener('request', updateRequests);
requestsManager.addEventListener('expire', updateRequests);
requestsManager.addEventListener('cancel', updateRequests);
requestsManager.addEventListener('delete', updateRequests);
requestsManager.addEventListener('clear', updateRequests);
requestsManager.addEventListener('offer', updateRequests);
requestsManager.addEventListener('subscribe', onRequestSubscribe);
requestsManager.addEventListener('unsubscribe', onRequestUnsubscribe);

dealsManager.addEventListener('changed', updateDeals);

await client.start();
```

Please note that the event handlers (`onClientStart`, `onClientStop`, etc.) need to be defined and implemented according to your specific application's requirements. They will dictate the behavior of your application when certain events occur.

Remember to customize the event handlers and implement the behavior that suits your application's needs for a seamless and user-friendly experience.

Once the client is started and connected to the coordination server, we will be ready to send requests.

### Building a Request

To build a request, you can utilize the `buildRequest` utility function provided by the `@windingtree/sdk-messages` package. Before using this function, ensure that you have already created the `RequestQuery` data type, as it will be used as an option for the function. Here's an example of how to build a request:

```typescript
import { buildRequest } from '@windingtree/sdk-messages';

const request = await buildRequest<RequestQuery>({
  topic: '<TOPIC_THAT_NODE_LISTENS_FOR>',
  /**
   * The expiration time of the request.
   * You can use `s`, `m`, `h` for seconds, minutes, and hours respectively.
   * Alternatively, you can provide a number representing the expiration time in seconds.
   */
  expire: '1d',
  /**
   * It is possible to create and send different versions of the same request.
   * A node will automatically choose the version with a higher `nonce` value as the source for the offer.
   */
  nonce: BigInt(1),
  query: {
    greeting: 'Hello',
  },
});

console.log(request);
// Example output:
// {
//   id: '0x22a66237b67b7b6a6e0f78844aa958c25f3205951a0701dca97454a6a80d1ee2',
//   expire: 1680258961,
//   nonce: 1,
//   topic: 'hello',
//   query: {
//     greeting: 'Hello',
//   },
// }
```

### Publishing the Request

Once you have successfully built the request, the next step is to publish it to the network. The `client` object, which is an instance of the protocol client, is responsible for handling the publishing process. Here's an example of how to publish the request:

```typescript
// Assuming you have already created the `client` object
// and it is an instance of the protocol client.

// Publish the request to the network
client.publish(request);
```

By publishing the request, it will be broadcasted to the coordination server, and suppliers will be able to catch and respond to this request based on contextual subscriptions. This process facilitates the seamless interaction between buyers and suppliers within the WindingTree Market Protocol.

Please note that this example assumes you have already instantiated the `client` object and configured it to connect to the coordination server. If not, please refer to the appropriate steps in the documentation to set up the client properly before proceeding with request building and publishing.

## Processing Offers and Making Deals

After initializing the client and subscribing to relevant events, the client will handle the processing of offers received in response to the published requests. When an offer is received, it will be added to the `ClientRequestsManager` storage record, associated with the corresponding request. This allows the client to keep track of the offers available for each request.

### Viewing Request Records

To review the request records managed by the `ClientRequestsManager` instance, you can call the `getAll()` function. This function will return an array of request records, each containing information about the raw request data, associated offers, and the subscription status of the request. Alternatively, you can use the `get(<requestId>)` function to review a specific request record.

Here's an example of how to view request records:

```typescript
// Assuming you have already created the `requestsManager` instance.

// Get all request records
const allRequests = requestsManager.getAll();

// Get a specific request record by requestId
const requestId = '0xbed4a2a446f885983ba82be3b15ecbf10d7e2a7d0f943f02f538d8d1069169fa';
const specificRequest = requestsManager.get(requestId);
```

### Making Deals

When a user wants to make a deal based on an offer, they need to choose a payment option from the available payment options provided in the offer's `payment` array.

To make a deal, you can utilize the `dealsManager.create()` function. This function requires the following parameters:

- `offer`: The offer object received in response to the request.
- `paymentId`: The chosen payment option's ID from the available payment options.
- `retailerId`: The retailer's ID if applicable. If not providing a retailer ID, you can pass `ZeroHash`, which is a zero-filled bytes32 hash.
- `walletClient`: An instance of the wallet client. For more details on how to create `walletClient`, refer to the [documentation](https://viem.sh/docs/clients/wallet.html).
- A callback function that will be triggered when a transaction is initiated. The callback function provides information about the transaction hash and its context (e.g., "Asset approval" or "Deal creation").

Here's an example of how to make a deal:

```typescript
// Assuming you have already created the `dealsManager` instance.

await dealsManager.create(
  offer, // Offer object as received in response to the request
  paymentId, // Chosen payment option's ID
  ZeroHash, // Retailer's ID (use ZeroHash for no retailer ID)
  walletClient, // An instance of the wallet client
  (txHash, txContext) => {
    console.log(`Transaction: ${txHash} for ${txContext}`);
  }
);
```

The `create` function will initiate one or two transactions:

1. Payment asset approval: This transaction will call the `approve` function of the ERC20 asset. This step is optional if the asset has already been approved for the protocol smart contract.
2. Deal creation: This transaction will call the `deal` function of the protocol market contract to finalize the deal.

By following these steps, users can efficiently process offers, view request records, and proceed with making deals within the WindingTree Market Protocol.

## Deals Management

### Cancellation

To cancel a deal, users can utilize the `dealsManager.cancel()` function. This function requires the following parameters:

- `offer`: The raw offer object for the deal that needs to be canceled.
- `walletClient`: An instance of the wallet client. For more details on how to create `walletClient`, refer to the [documentation](https://viem.sh/docs/clients/wallet.html).
- A callback function that will be triggered when the cancellation transaction is initiated. The callback function provides information about the transaction hash.

Here's an example of how to cancel a deal:

```typescript
await dealsManager.cancel(
  offer, // Raw offer object
  walletClient,
  (txHash) => {
    console.log(`Transaction: ${txHash}`);
  }
);
```

### Transfer

To transfer ownership of a deal to another address, users can use the `dealsManager.transfer()` function. This function requires the following parameters:

- `offer`: The raw offer object for the deal that needs to be transferred.
- `to`: The address of the next owner to whom the deal will be transferred.
- `walletClient`: An instance of the wallet client. For more details on how to create `walletClient`, refer to the [documentation](https://viem.sh/docs/clients/wallet.html).
- A callback function that will be triggered when the transfer transaction is initiated. The callback function provides information about the transaction hash.

Here's an example of how to transfer a deal:

```typescript
await dealsManager.transfer(
  offer, // Raw offer object
  to, // Address of the next owner
  walletClient,
  (txHash) => {
    console.log(`Transaction: ${txHash}`);
  }
);
```

### Check-In

To check-in for a deal and finalize the transaction, users can use the `dealsManager.checkIn()` function. This function requires the following parameters:

- `offer`: The raw offer object for the deal that is being checked-in.
- `supplierSignature`: The signature provided by the offer's supplier.
- `walletClient`: An instance of the wallet client. For more details on how to create `walletClient`, refer to the [documentation](https://viem.sh/docs/clients/wallet.html).
- A callback function that will be triggered when the check-in transaction is initiated. The callback function provides information about the transaction hash.

Here's an example of how to perform the check-in:

```typescript
await dealsManager.checkIn(
  offer, // Raw offer object
  supplierSignature, // Signature provided by the offer's supplier
  walletClient,
  (txHash) => {
    console.log(`Transaction: ${txHash}`);
  }
);
```

By utilizing these functions, users can effectively manage their deals within the WindingTree Market Protocol, including canceling deals, transferring ownership, and finalizing the check-in process.


<!-- ## Managing funds

### Checking of balances

> Chain must be configured via client options

```typescript
const balance = await client.wallet.balance(chainId, address);
console.log(`Balance of ${address} in ${chainId}`: balance.toString());
```

### Bridging assets

```typescript
await client.bridge(
  'polygon', // Bridge name
  '0x..', // Asset contract address
  '100000000000000000000', // Bridging value in WEI
  (txHash) => {
    // Bridging transaction hash callback
    console.log(`Tokens bridging: ${txHash}`);
  },
);
console.log('Tokens bridged, check your balance on target network');
```

### Exiting assets

```typescript
await client.exit(
  'polygon', // Bridge name
  '0x..', // Asset contract address to exit out
  '100000000000000000000', // Value in WEI
  (txHash) => {
    // Transaction hash callback
    console.log(`Tokens exiting: ${txHash}`);
  },
);
console.log('Tokens exited, check your balance on target network');
```

## Making a deal

```typescript
const deal = await offer.deal('1cf51a15-da09-4a68-929d-84e60901ca0f', (txHash) => {
  console.log(`Making a deal: ${txHash}`);
});
console.log('Success! Start waiting for the confirmation from the supplier');
```

A `deal` object that is returning by the `offer.deal` is following the interface:

```typescript
interface DealAction<Action extends string> {
  chainId: number;
  tokenId: number;
  supplierId: string;
  action: Action;
}

interface Deal {
  tokenId: number; // The deal NFT id
  supplier: string; // The supplier Id registered on the smart contract
  status: // Current deal status
    | 'DEAL_PENDING'
    | 'DEAL_ACCEPTED'
    | 'DEAL_REJECTED'
    | 'DEAL_CANCELLED'
    | 'DEAL_CHECKED_IN';
  reason: string; // A reason of a current state change
  date: string; // Latest state change date
  async owner(): Promise<string>;
  async signCheckIn(): Promise<DealAction<'check-in'>>; // Creates a check-in payload and signature
  async checkIn(signature: string, (txHash: string) => void): Promise<void>;
  async cancel((txHash: string) => void): Promise<void>; // Makes the deal cancellation  (if it is possible)
  subscribe<CustomOfferType>(async function({ message: CustomOfferType }): Promise<void>, OffersSubscriptionOptions): () => void; // Return `unsubscribe` function for current subscription
  unsubscribe(): void; // Unsubscribe all subscriptions
  toString(): string; // Serialize a Deal into string
}
```

## Checking a deal state

```typescript
import {
  DEAL_PENDING,
  DEAL_ACCEPTED,
  DEAL_REJECTED,
  DEAL_CANCELLED,
  DEAL_CHECKED_IN,
} from '@windingtree/sdk/constants';

const tokenId = await deal.subscribe(({ tokenId, supplier, status, reason }: DealDetails) => {
  switch (status) {
    case DEAL_ACCEPTED:
      console.log(`The deal #${tokenId} has been confirmed by the supplier ${supplier}`);
      break;
    case DEAL_REJECTED:
      console.log(
        `The deal #${tokenId} has been rejected by the supplier ${supplier} with the reason ${reason}`,
      );
      break;
    case DEAL_CANCELLED:
      console.log(`The deal #${tokenId} has been cancelled by the client`);
      break;
    case DEAL_PENDING:
      return true;
    default:
      console.log('Unknown deal status response');
  }
  return false;
});

// To check the deal state later
const deal = await client.deal(chainId, tokenId);

// deal.status: DEAL_PENDING, DEAL_ACCEPTED, DEAL_REJECTED, DEAL_CANCELLED, DEAL_CHECKED_IN
console.log(`The deal #${tokenId} status:`, status);
```

> Returning the `false` value from the deal status subscription callback will automatically stop the subscription.

## Checkin

There are two types of check-in:

- check-in on `reception` (provided by the current version of the protocol);
- `online` check-in (to be implemented soon);

Here is how the `reception` check-in type is implemented:

- on the clients' side is generated an object with the following content:

```json
{
  "chainId": _DEAL_CHAIN_ID_,
  "tokeId": _DEAL_TOKEN_ID_,
  "supplierId": "_SUPPLIER_ID_",
  "action": "check-in"
}
```

- This object is signing using the private key of the deal NFT owner (typed, EIP-712 signature)
- A signed object is transferred to the supplier via a special QR code
- After the QR code is scanned by a reception manager, his application is decoding the code and makes a request to the supplier's node for a check-in attempt
- To make check-in the supplier's node is sending a request to the smart contract which Is able to check the signature provided by the client. If this signature is valid the smart contract will update the deal as checked-in

### Generation of the `check-in` signature:

```typescript
// Create the deal object
const deal = await client.deal(chainId, tokenId);

// Sign the check-in data
const { payload, signature } = await deal.signCheckIn();

// Subscribe to status changes
const unsubscribe = deal.subscribe(({ status }) => {
  switch (status) {
    case DEAL_CHECKED_IN:
      console.log(`The deal #${tokenId} has been checked-in`);
      return false;
    default:
      return true; // Just continue listening
  }
});

// ... and show the QR to the reception manager (see next chapter)

// You can suspend your deal status subscription at any time by:
unsubscribe();
```

### Creation of the QR code

Here is an example of simple component that display a QR in the React-based application using the `qrcode.react` package:

```typescript
import { CheckInVoucher } from '@windingtree/sdk';
import { QRCodeSVG } from 'qrcode.react';

export const MySignInQr = ({ payload, signature }: CheckInVoucher) => {
  if (!payload || !signature) {
    return null;
  }

  return (
    <div>
      <QRCodeSVG
        value={JSON.stringify({ tokenId, signature })}
        size={256}
        bgColor="#ffffff"
        fgColor="#000000"
        level="L"
        includeMargin={false}
      />
    </div>
  );
};
```

## Cancellation

There exist two types of deal cancellation that are available to the client:

- the cancellation of the `not-claimed` deal. Possible until the deal is claimed by the supplier. 100% of the funds paid will be refunded in such case of cancellation
- the cancellation of the `claimed` deal according to the rules defined by the supplier in the offer

If the supplier defined cancellation rules in the offer, as in the example below:

```json
"cancel": [
  {
    "id": "79528ee0-0300-4695-926e-065f485ce0c7",
    "time": 1209600,
    "penalty": 50
  },
  {
    "id": "9b0a55e2-c276-46c7-a310-0c4f6c056070",
    "time": 604800,
    "penalty": 100
  }
],
```

...in this case, the returned value will be affected by a penalty. The cancellation option will be chosen by the smart contract depending on the value of time before the check-in time of the deal.

> Already `checked-in` deals or deals with `checkIn` time cannot be cancelled by the client.

```typescript
// Create the deal object
const deal = await client.deal(chainId, tokenId);

// Start cancellation
await deal.cancel((txHash) => {
  console.log(`The deal #${deal.tokenId} is cancelling ${txHash}`);
});

console.log(`The deal #${deal.tokenId} has been successfully cancelled`);
``` -->
