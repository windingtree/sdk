# Supplier flow

## Supplier configuration

### Owner credentials

EOA or multisig account in the target network. This account is for:

- Registration of the supplier entity in the protocol smart contract
- Creation or changing of the signer account that is dedicated to signing the supplier's offers
- Managing the LIF deposit balance
- Owning the supplier's deals funds

### Signer credentials

EOA

### Supplier subject

This is a tag or a set of tags that depend on the use cases of the supplier business. If this use case is the hotel this tag will be the geolocation hash that represents the hotel address. If this use case is an abstract service provided without linkage to geolocation this tag can be the special unique code of service.

For hotels the protocol recommends using H3 (Hexagonal hierarchical geospatial indexing system) that looks like this: `87283472bffffff`.

The protocol provides with function for converting traditional lat/lng coordinates to `h3` hash and overwise.

Here is an example:

```typescript
import { utils } from '@windingtree/sdk';

const h3Index = utils.latLngToCell(37.3615593, -122.0553238);
// -> '87283472bffffff'

const hexCenterCoordinates = utils.cellToLatLng(h3Index);
// -> [37.35171820183272, -122.05032565263946]
```

### Registration

The supplier must register its entity by sending a transaction to the protocol smart contract. Here is the registration function ABI:

```solidity
function register(
  bytes32 salt,
  address owner,
  address signer,
  uint256 lifDeposit,
  bytes permit
) external;
```

> If the protocol network will support the LIF token as a native token (optional) the `register` function ABI will also have a `payable` modifier

A unique identifier of the supplier will be calculated by the protocol smart contract as a `keccak256` hash of provided `salt` and the address of the transaction sender.

The `owner` argument is the address of the supplier entity owner. After the registration, this account exclusively will be allowed to change the signer address and manage the LIF token deposit as well.

The `signer` argument is the address that is delegated by the `owner` to sign offers.

The `lifDeposit` argument is the amount of the LIF tokens that the `sender` wants to deposit into the account (in WEI). If a zero `lifDeposit` value is provided the processing of the tokens deposit in this transaction will be skipped.

The `permit` argument is the EIP-712 signature with the allowance to the contract to spend a proper amount of tokens.

### LIF deposit

This is a set of two smart contract functions for managing the LIF deposit funds of a supplier.

Adding deposits:

```solidity
function lifDeposit(uint256 amount, bytes permit) external;
```

Deposits withdrawal:

```solidity
function lifDepositWithdraw(uint256 amount) external;
```

> These functions can be called by the supplier `owner` only.

## Create the node

More about the node configuration options is [here](./index.md#supplier-node).

```typescript
import {
  GenericQuery,
  GenericOfferOptions,
  NodeOptions,
  createNode,
} from '@windingtree/sdk';

export interface RequestQuery extends GenericQuery {
  /** your custom request interface */
}

export interface OfferOptions extends GenericOfferOptions {
  /** suppliers' offer options interface */
}

const options: NodeOptions = {
  /** ... */
};

const node = createNode<RequestQuery, OfferOptions>(options);
await node.start(); // Start the client
await node.stop(); // Stop the client
```

## Subscription to node's events

A node allows subscribing to the following event types.

- `connected`: emitted when the node is connected to the coordination server
- `disconnected`: emitted when the node is disconnected
- `start`: emitted when the node is started
- `stop`: emitted when the node is stopped
- `heartbeat`: emitted every second, useful for performing utility functions
- `request`: emitted on every incoming request

```typescript
node.addEventListener('connected', () => {
  console.log('Connected!');
});

node.addEventListener('disconnected', () => {
  console.log('Disconnected!');
});

node.addEventListener('start', () => {
  console.log('Node started');
});
```

## Subscribing to requests

To start listening to requests the supplier must provide a list of `topics` in the node configuration options.

```typescript
import { utils } from '@windingtree/sdk';

const topic = utils.latLngToCell(coordinates.lat, coordinates.lng);
// -> ['87283472bffffff']

const options: NodeOptions = {
  /** ... */
  topics: [topic], // <-- When started the node will be subscribed to these topics
};

const node = createNode(options);
```

To add a requests handler you should subscribe to the `request` event of the node.

```typescript
node.addEventListener('request', async ({ data }): Promise<void> => {
  console.log(`Got the request #${data.id} with query: ${data.query}`);
  // - validation of the request: expiration time, query parameters, etc
  // - adding the request to the processing queue
});
```

## Requests processing

It is recommended that all incoming requests that are passed validation should be added to the requests queue to be persisted there and properly processed. If the node will be reloaded, this requests queue will be restored and no one incoming request will be missed.

> It is not mandatory to add requests to the queue. If you want, you can skip this step and process requests right in the `request` event handler. However, you should be aware that this approach can cause requests to drop between application restarts. Also, this approach will consume more system resources because all request handlers will be processed in system memory at the same time.

Before start using the requests queue you should configure an asynchronous processing callback and register it in the `Queue` utility instance.

```typescript
import { storage, Queue, createJobHandler } from '@windingtree/sdk';

const storageInit = await storage.memoryStorage.createInitializer();

const queue = new Queue({
  /** You can use any other available storage options */
  storage: storageInit(),
  hashKey: 'jobs',
  concurrentJobsNumber: 10,
});

/**
 * This is interface of object that you want to pass to the job handler as options
 */
interface RequestHandlerOptions {
  node: Node<RequestQuery, OfferOptions>;
}

/**
 * Handler should be created using createJobHandler factory function
 */
const requestsHandler = createJobHandler<
  RequestData<CustomRequestQuery>,
  RequestHandlerOptions
>(async (data, options) => {
  // data - raw request
  // options - object with everything else you want pass into the handler at run time
});

/**
 * Registering of the request handler in the queue
 */
queue.addJobHandler(
  'request',
  requestsHandler({
    /**
     * Passing a node reference.
     * This reference will be available in the handler through the `options` argument
     * */
    node,
  }),
);
```

To add a request to the queue you should use the `addJob` method of the `Queue` utility instance.

```typescript
/**
 * Creation of the job
 */
queue.addJob('request', rawRequest, {
  /** Forget about this request if it is expired */
  expire: rawRequest.expire,
});
```

## Building and publishing of offer

It is the idea to generate an offer on every valid and acceptable request. Associated logic should be incorporated into the request queue handler as explained in the previous chapter.

Every offer structure must follow the generic message data structure proposed by the protocol.

Here is type of an offer:

```typescript
type OfferData<RequestQuery, OfferOptions> = {
  /** Custom offer options */
  options: OfferOptions;
  /** Uniquer offer id */
  id: string;
  /** Offer expiration time */
  expire: number;
  /** Offer nonce. Must be equal to 1 */
  nonce: number;
  /**
   * Copy of request obtained
   * {RequestData<RequestQuery>}
   **/
  request: {
    id: string;
    expire: number;
    nonce: number;
    topic: string;
    query: RequestQuery;
  };
  /**
   * Payment options
   * {PaymentOption}
   **/
  payment: {
    id: string;
    price: string;
    asset: string;
  }[];
  /**
   * Cancellation rules
   * {CancelOption}
   **/
  cancel: {
    time: number;
    penalty: number;
  }[];
  /**
   * Offer payload
   * {UnsignedOfferPayload}
   **/
  payload: {
    /** Unique supplier Id registered on the protocol contract */
    supplierId: string;
    /** Target network chain Id */
    chainId: number;
    /** <keccak256(request.hash())> */
    requestHash: string;
    /** <keccak256(JSON.stringify(offer.options))> */
    optionsHash: string;
    /** <keccak256(JSON.stringify(offer.payment))> */
    paymentHash: string;
    /** <keccak256(JSON.stringify(offer.cancel(sorted by time DESC) || []))> */
    cancelHash: string;
    /** makes the deal NFT transferable or not */
    transferable: boolean;
    /** check-in time in seconds */
    checkIn: number;
  };
  /** EIP-712 (Typed) signature */
  signature: string;
};
```

To build and publish an offer you should use the `buildOffer` method of a node instance.

```typescript
const offer = await node.buildOffer({
  /** Offer expiration time */
  expire: '30s',
  /** Copy of request */
  request: detail.data,
  /** Random options data. Just for testing */
  options: {
    date: DateTime.now().toISODate(),
    buongiorno: Math.random() < 0.5,
    buonasera: Math.random() < 0.5,
  },
  /**
   * Dummy payment option.
   * In production these options managed by supplier
   */
  payment: [
    {
      id: simpleUid(),
      price: '1',
      asset: ZeroAddress,
    },
  ],
  /** Cancellation options */
  cancel: [
    {
      time: nowSec() + 500,
      penalty: 100,
    },
  ],
  /** Check-in time */
  checkIn: nowSec() + 1000,
});
```

## Checking and processing a deal

When a client receives one or many offers on his request he chooses one and sends a transaction to the smart contract. If this transaction is succeeded a `Deal` is registered and can be detected by the supplier node.

Detecting a Deal is possible in two ways. The first option is listening for the smart contract events (`Deal` event). The second is continuous smart contract state monitoring.

Listening to smart contract events is a simple but not scalable way in case of huge traffic of deals. In this case, all responsibility is moved to the blockchain network provider (JSON-RPC provider) side. A huge amount of listeners may bring the provider to an unstable state. Because of that the risk of a Deal event missing is rising.

The second, alternative way is creating a queue-enabled poller that will repeatedly request the smart contract for concrete deals until related offers expired.

Depending on the business and offer traffic scale both strategies can be implemented using SDK features.

Here is demonstrated a variant that uses poller based on `Queue` utility.

```typescript
/**
 * A Deal job handler should be created in the same way as requests
 */

queue.addJob('deal', offer, {
  expire: offer.expire,
  every: 5000, // 5 sec
});
```

## Checking for cancellation

The cancellation of a deal can be detected and processed in the same way as deal creation through smart contract events and using a queue-based poller.

## Checkin

To be able to withdraw funds from the deal the supplier should complete the `checkin` procedure. It is possible to do this in two ways:

- Before the `checkin` date using the approval signature from the buyer
- After the `checkin` date without any other conditions

### With approval signature

At reception, the supplier manager should ask the buyer to provide the signed check-in voucher. Usually, this voucher comes in the form of QR code which after decoding looks like:

```json
{
  "payload": {
    "chainId": 127,
    "tokeId": 3,
    "supplierId": "0x...",
    "action": "check-in"
  },
  "signature": "0x..."
}
```

This signature is the EIP-712 (typed) signature that represents the following domain and values:

```typescript
interface CheckInEip712Domain {
  name: string; // Verifying contract name
  version: string; // Verifying contract version
  chainId: number; // L3 chain Id
  verifyingContract: string; // Verifying contract address
}

const checkInEip712Types = {
  Checkin: [
    {
      name: 'tokenId';
      type: 'uint256';
    },
    {
      name: 'supplierId';
      type: 'bytes32';
    },
  ];
}

interface CheckInEip712Values {
  tokenId: number;
  supplierId: string;
}
```

Now, the supplier is able to check the signature validity and send the `check-in` transaction to the protocol smart contract.

```typescript
import { CheckInVoucher, DealStatus, utils } from '@windingtree/sdk';

// Your custom QR scanning logic
const getVoucher = async (): Promise<CheckInVoucher> => {
  /* scan the QR code => rawVoucher */
  const voucher = JSON.parse(rawVoucher) as CheckInVoucher;
  utils.verifyCheckInVoucher(voucher);
  return voucher;
};

const { payload, signature } = await getVoucher();

const deal = await node.getDeal(payload.chainId, payload.tokenId); // will throw if the deal not found

if (deal.status !== DealStatus.ACCEPTED) {
  throw new Error('Invalid deal');
}

const owner = await deal.owner();

const buyerAddress = utils.verifyCheckInSignature(payload, signature);

if (buyerAddress !== owner) {
  throw new Error('Invalid signature');
}

await node.checkIn(deal, (txHash) => {
  console.log(`CheckIn transaction ${txhash} is pending`);
}); // will throw if not succeeded

console.log('Nice!');
```

When the check-in transaction is successful all the funds that are locked in the deal will be transferred to the supplier account.
The deal will be updated and marked as checked-in.
