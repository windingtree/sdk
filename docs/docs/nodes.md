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
import { latLngToCell, cellToLatLng } from '@windingtree/sdk/utils';

const h3Index = latLngToCell(37.3615593, -122.0553238);
// -> '87283472bffffff'

const hexCenterCoordinates = cellToLatLng(h3Index);
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
import { NodeOptions, createNode } from '@windingtree/sdk';

const options: NodeOptions = {
  /*...*/
};

const node = createNode(options);
await node.start(); // Start the client
await node.stop(); // Stop the client
```

## Subscription to node's events

A node allows subscribing to the following event types.

- `connect`: emitted when the node is connected to the coordination server
- `disconnect`: emitted when the node is disconnected
- `pause`: emitted when the coordination server moves in paused state
- `heartbeat`: emitted every second, useful for performing utility functions
- `request`: emitted on every incoming request

```typescript
node.subscribe('connect', () => {
  console.log('Connected!');
});

node.subscribe('disconnect', () => {
  console.log('Disconnected!');
});

node.subscribe('pause', ({ reason }) => {
  console.log(`Server paused due to: ${reason}`);
});
```

## Subscribing to requests

To start listening to requests the supplier must provide a list of `subjects` in the node configuration options. If this option has not been provided during the configuration step it will be possible to subscribe to requests later using the `addSubjects` method of the node and `removeSubjects` for removing subscriptions.

```typescript
import { latLngToCell } from '@windingtree/sdk/utils';

const subject = latLngToCell(coordinates.lat, coordinates.lng);
node.addSubjects([subject]);
node.getSubjects();
// -> ['87283472bffffff']

node.removeSubjects([subject]);
node.getSubjects();
// -> null
```

To add a requests handler you should subscribe to the `request` event of the node.

```typescript
node.subscribe('request', async ({ data }: Request): Promise<void> => {
  console.log(`Got the request #${data.id} with query: ${data.query}`);
  // - validation of the request: expiration time, query parameters, etc
  // - adding the request to the processing queue
});
```

## Requests processing

It is recommended that all incoming requests that are passed validation should be added to the requests queue to be persisted there and properly processed. If the node will be reloaded, this requests queue will be restored and no one incoming request will be missed.

> It is not mandatory to add requests to the queue. If you want, you can skip this step and process requests right in the `request` event handler. However, you should be aware that this approach can cause requests to drop between application restarts. Also, this approach will consume more system resources because all request handlers will be processed in system memory at the same time.

Before start using the requests queue you should configure an asynchronous processing callback. You can do it using the `register` method of the `node.requestQueue`.

```typescript
interface RequestsQueueTask {
  id: string;
  status: 'REQUEST_TASK_PENDING' | 'REQUEST_TASK_PROCESSING' | 'REQUEST_TASK_FAILED' | 'REQUEST_TASK_DONE';
  request: Request;
  errors: Error[];
}

node.requestsQueue.register(async (task: RequestsQueueTask): Promise<void> => {
  // ...do something with the request
  // see "Building of offer" below
});
```

To add a request to the queue you should use the `add` method of the `node.requestQueue`.

```typescript
const taskId = node.requestsQueue.add(request);
const task = await node.requestsQueue.get(taskId);
// -> RequestsQueueTask instance
```

## Building of offer

It is the idea to generate an offer on every valid request. Associated logic should be incorporated into the request queue handler as explained in the previous chapter.

Every offer structure must follow the generic message data structure proposed by the protocol.

Here is the types structure of an offer:

```typescript
// Common message structure
interface GenericMessage {
  id: string; // Unique message Id
  expire: number; // Expiration time in seconds
  nonce?: number; // A number that reflects the version of the message
  [key: string]: unknown;
}

// Generic offer is just an object with props
type GenericOfferOptions = Record<string, unknown>;

// Offered payment option
interface PaymentOption {
  id: string; // Unique payment option Id
  price: string; // Asset price in WEI
  asset: string; // ERC20 asset contract address
}

// Offered cancellation option
interface CancelOption {
  time: number; // Seconds before checkIn
  penalty: number; // percents of total sum
}

// Offer payload
interface UnsignedOffer {
  supplierId: string; // Unique supplier Id registered on the protocol contract
  chainId: number; // Target network chain Id
  requestHash: string; // <keccak256(request.hash())>
  optionsHash: string; // <keccak256(JSON.stringify(offer.options))>
  paymentHash: string; // <keccak256(JSON.stringify(offer.payment))>
  cancelHash: string; // <keccak256(JSON.stringify(offer.cancel(sorted by time DESC) || []))>
  transferable: boolean; // makes the deal NFT transferable or not
  checkIn: number; // check-in time in seconds
}

interface SignedOffer extends UnsignedOffer {
  signature: string; // EIP-712 TypedSignature(UnsignedOffer)
}

// Generic offer is just an object with props
type GenericOfferOptions = Record<string, unknown>;

interface BaseOfferData<OfferOptions extends GenericOfferOptions> {
  options: OfferOptions; // Supplier-specific offer options
  payment: PaymentOption[]; // Payment options
  cancel?: CancelOption[]; // Cancellation options
}

interface OfferData<RequestQuery extends GenericQuery, OfferOptions extends GenericOfferOptions>
  extends GenericMessage,
    BaseOfferData<OfferOptions> {
  request: RequestData<RequestQuery>; // Copy of associated request
  offer: UnsignedOffer;
  signature: string; // EIP-712 TypedSignature(UnsignedOffer)
}
```

To build an offer you should use the `buildOffer` method of arrived `request` object.

```typescript
request.buildOffer<BaseOfferData<CustomOfferOptions>>(
  baseData: BaseOfferData<CustomOfferOptions>,
  expire: string,
  validator?: (data: BaseOfferData<CustomOfferOptions>) => void
): Offer<CustomRequestQuery, BaseOfferData<CustomOfferOptions>>
```

The `Offer` that produced by `request.buildOffer` is an object that implements the following interface:

```typescript
interface OfferMetadata {
  id: string; // Offer Id
  requestId: string; // Request Id to which the offer is stuck to
  published?: string; // ISO DateTime
  received?: string; // ISO DateTime
  expire: number; // Time in seconds
  valid: boolean; // Validation result
  error?: string[]; // Validation errors
}

interface Offer<CustomRequestQuery extends GenericQuery, CustomBaseOfferData extends BaseOfferData<CustomOfferOptions>> {
  data: OfferData<CustomRequestQuery, CustomBaseOfferData>;
  metadata: OfferMetadata;
  async validate(): Promise<void>;
  async deal(paymentOptionId: number, txCallback?: (txHash: string) => void): Promise<void>;
  subscribe(async function(tokeId: number): Promise<void>): void;
  unsubscribe(): void;
  toString(): string; // Serialize a OfferData<CustomRequestQuery, CustomBaseOfferData> into string
}
```

The `Offer` object exposed the following methods:

- `subscribe(callback)`: creates subscription to deals associated with the offer
- `unsubscribe()`: removes the subscription to deals
- `toString()`: serializes the offer object
- `hash()`: creates a standardized hash of the serialized object data

Here an example how you can build an offer:

```typescript
import { CustomQueryType } from './types';

interface MyOfferOptions {
  checkInDate: string; // ISO 8601 ISO Date
  checkOutDate: string; // ISO 8601 ISO Date
  guests: {
    adults: number;
    children?: number;
  },
  rooms?: number;
  amenities?: string[];
  lateCheckIn?: boolean;
}

const myOfferValidator = (data: MyOffer): void => {
  // your validation logic
  // - should validate an offer data
  // - should throw an Error in case of mistakes
};

const offer = node.buildOffer<CustomQueryType, MyOfferOptions>(
  {
    supplierId: '0x9300bad07f0b9d90...701db2539b7a5a119',
    // Offer options
    options: {
      checkInDate: '2023-04-20',
      checkOutDate: '2023-04-25',
      guests: {
        adults: 2,
        children: 0,
      },
      rooms: 1,
      amenities: [
        'wifi',
      ];
      lateCheckIn: true,
    },
    // Payment options
    payment: [
      {
        id: '1cf51a15-da09-4a68-929d-84e60901ca0f',
        asset: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USD
        price: '100000000000000000000',
      },
      {
        id: '1937734a-e1e2-41c9-a8cf-1ffd650f6407',
        asset: '0x55d398326f99059ff775485246999027b3197955', // EUR
        price: '90000000000000000000'
      }
    ],
    // Cancellation options
    cancel: [
      {
        time: 86400 * 7 * 2, // two week before checkin
        penalty: 50 // 50% penalty
      },
      {
        time: 86400 * 7, // one week before checkin
        penalty: 100 // 100% penalty (means "0")
      }
    ],
    transferable: false, // a deal will not be transferrable
  },
  '30m',
  1,
  validator: myOfferValidator,
);

console.log(offer.toString());
/*
  {
    "supplierId": "0x9300bad07f0b9d90...701db2539b7a5a119",
    "chainId": 000,
    "options": {
      "checkInDate": "2023-04-20",
      "checkOutDate": "2023-04-25",
      "guests": {
        "adults": 2,
        "children": 0
      },
      "rooms": 1,
      "amenities": [
        "wifi"
      ];
      "lateCheckIn": true
    },
    "payment": [
      {
        "id": "1cf51a15-da09-4a68-929d-84e60901ca0f",
        "asset": "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
        "price": "100000000000000000000"
      },
      {
        "id": "1937734a-e1e2-41c9-a8cf-1ffd650f6407",
        "asset": "0x55d398326f99059ff775485246999027b3197955",
        "price": "90000000000000000000"
      }
    ],
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
    "requestHash": "0x.."
    "optionsHash": "0x.."
    "paymentHash": "0x.."
    "cancelHash": "0x.."
    "transferable": false,
    "checkIn": 1681948800,
    "signature": "0xd398326f99059ff7754...3fe1ad97b32"
  }
*/
```

## Sending of offer

```typescript
offer.publish();
```

## Checking and processing a deal

```typescript
offer.subscribe(async (tokenId: number): Promise<boolean> => {
  console.log(`The deal # ${tokenId} is detected for offer ${offer.data.id}`);
  // ...processing the availability
  return false; // to remove the subscription
});
```

## Checking for cancellation

```typescript
import { DEAL_CANCELLED } from '@windingtree/sdk';
// Create the deal object
const deal = await node.deal(chainId, tokenId);

if (deal.status === DEAL_CANCELLED) {
  console.log(`The deal #${tokenId} has been cancelled by the client`);
}
```

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
import { CheckInVoucher, DEAL_ACCEPTED } from '@windingtree/sdk';
import { verifyCheckInVoucher, verifyCheckInSignature } from '@windingtree/sdk/utils';

// Your custom QR scanning logic
const getVoucher = async (): Promise<CheckInVoucher> => {
  /* scan the QR code => rawVoucher */
  const voucher = JSON.parse(rawVoucher) as CheckInVoucher;
  verifyCheckInVoucher(voucher);
  return voucher;
};

const { payload, signature } = await getVoucher();

const deal = await node.getDeal(payload.chainId, payload.tokenId); // will throw if the deal not found

if (deal.status !== DEAL_ACCEPTED) {
  throw new Error('Invalid deal');
}

const owner = await deal.owner();

const buyerAddress = verifyCheckInSignature(payload, signature);

if (buyerAddress !== owner) {
  throw new Error('Invalid signature');
}

await deal.checkIn(signature, (txHash) => {
  console.log(`CheckIn transaction ${txhash} is pending`);
}); // will throw if not succeeded

console.log('Nice!');
```

When the check-in transaction is successful all the funds that are locked in the deal will be transferred to the supplier account.
The deal will be updated and marked as checked-in.
