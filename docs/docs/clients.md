# Client flow

## Create the protocol client

More about the client configuration options is [here](./index.md#client-node).

```typescript
import { ClientOptions, createClient } from '@windingtree/sdk';

const options: ClientOptions = {
  /*...*/
};

const client = createClient(options);
await client.start(); // Start the client
await client.stop(); // Stop the client
```

## Subscription to client's events

A client allows subscribing to the following event types.

- `connect`: emitted when the client is connected to the coordination server
- `disconnect`: emitted when the client is disconnected
- `pause`: emitted when the coordination server moves in paused state
- `heartbeat`: emitted every second, useful for performing utility functions

```typescript
client.subscribe('connect', () => {
  console.log('Connected!');
});

client.subscribe('disconnect', () => {
  console.log('Disconnected!');
});

client.subscribe('pause', ({ reason }) => {
  console.log(`Server paused due to: ${reason}`);
});
```

## Building of request

Every request structure must follow the generic message data structure proposed by the protocol.

```typescript
type GenericQuery = Record<string, unknown>;

// Common message structure
interface GenericMessage {
  id: string; // Unique message Id
  expire: number; // Expiration time in seconds
  nonce?: number; // A number that reflects the version of the message
  [key: string]: unknown;
}

// Request data structure
interface RequestData<RequestQuery extends GenericQuery> extends GenericMessage {
  query: RequestQuery; // Industry specific query type
}
```

To build a request you should use the `buildRequest` method of SDK.

```typescript
buildRequest<CustomRequestQuery>(
  data: CustomRequestQuery,
  expire: string,
  nonce?: number,
  validator?: (data: CustomRequestQuery) => void
): Request<CustomRequestQuery>
```

The `Request` that produced by `buildRequest` is an object that implements the following interface:

```typescript
interface RequestMetadata {
  id: string; // Request Id
  published?: string; // ISO DateTime
  received?: string; // ISO DateTime
  expire: number; // Time in seconds
  offers: string[]; // Offers Ids
}

interface Request<CustomRequestQuery> {
  data: RequestData<CustomRequestQuery>;
  metadata: RequestMetadata;
  change(
    data: CustomRequestQuery,
    expire: string
  ): void; // Updates `data`, also updates `expire` time and increases `nonce` in a RequestData
  subscribe<CustomOfferType>(async function({ message: CustomOfferType }): Promise<void>, OffersSubscriptionOptions): () => void; // Returns `unsubscribe` function for current subscription
  unsubscribe(): void; // Unsubscribe all subscriptions
  toString(): string; // Serialize a RequestData<CustomRequestQuery> into string
  hash(): string; // Standardized has of the serialized object data
}
```

Here an example how you can build a request:

```typescript
import { buildRequest } from '@windingtree/sdk';

interface MyQuery {
  location: string; // H3 index. e.q. '8928342e20fffff'
  checkInDate: string; // ISO 8601 Date e.q. '2023-04-20'
  checkOutDate: string; // ISO 8601 Date e.q. '2023-04-25'
  guests: {
    adults: number;
    children?: number;
  };
  rooms?: number;
  amenities?: string[];
  lateCheckIn?: boolean;
}

const myQueryValidator = (data: MyQuery): void => {
  // your validation logic
  // - should validate a query data
  // - should throw an Error in case of mistakes
};

const request = buildRequest<MyQuery>(
  {
    location: '8928342e20fffff',
    checkInDate: '2023-04-20',
    checkOutDate: '2023-04-25',
    guests: {
      adults: 2,
      children: 0,
    },
    rooms: 1,
    amenities: ['wifi', 'pets allowed', 'balcony'],
  },
  '1h',
  1,
  myQueryValidator,
);

console.log(request.toString());
/*
  {
    "id": "19817818-9d87-43cd-b6cf-6b965685c2d4",
    "expire": 1676548866,
    "nonce": 1,
    "query": {
      "location": "8928342e20fffff",
      "checkInDate": "2023-04-20",
      "checkOutDate": "2023-04-25",
      "guests": {
        "adults": 2,
        "children": 0,
      },
      "rooms": 1,
      "amenities": [
        "wifi",
        "pets allowed,
        "balcony,
      ]
    }
  }
*/
```

Now we can change the request (update its data):

```typescript
request.change(
  {
    location: '8928342e20fffff',
    checkInDate: '2023-04-22',
    checkOutDate: '2023-04-27',
    guests: {
      adults: 3,
      children: 0,
    },
    rooms: 2,
    amenities: ['wifi'],
  },
  '1d',
);

console.log(request.toString());
/*
  {
    "id": "19817818-9d87-43cd-b6cf-6b965685c2d4",
    "expire": 1676638507,
    "nonce": 2,
    "query": {
      "location": "8928342e20fffff",
      "checkInDate": "2023-04-22",
      "checkOutDate": "2023-04-27",
      "guests": {
        "adults": 3,
        "children": 0,
      },
      "rooms": 2,
      "amenities": [
        "wifi"
      ]
    }
  }
*/
```

## Subscribing to offers

```typescript
import { OffersSubscriptionOptions } from '@windingtree/sdk';

const options: OffersSubscriptionOptions = {
  autoValidate: false,
};

request.subscribe<OfferData>(async ({ id, offer }, options) => {
  console.log('Offer arrived!', id);
  console.log('Offer:', offer.toString());
  try {
    const validationResult = await offer.validate();
  } catch (error) {
    console.log(`Offer #${is} is not valid: ${error.message}`);
  }
});
```

> The subscription will be started when the request published

> The subscription will be automatically removed (unsubscribed) when the request expiration time is exhausted

> Important! Suppliers can send multiple offers with different options and prices in response to the same request. The client should collect all of them in a special period of time and then propose to the user options to choose the best-fitted one.

## Sending of request

```typescript
try {
  await client.publish(request);
  console.log('Request is published!');
} catch (error) {
  console.log(`Publishing error: ${error.message}`);
}
```

## Processing offers

Offers obtained in the requests handler will be objects that implement the following interface:

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

interface Offer<CustomQueryType, CustomOfferType> {
  data: OfferData<CustomOfferType>;
  metadata: OfferMetadata;
  validate(): Promise<void>;
  deal(paymentOptionId: number, txCallback?: (txHash: string) => void): Promise<void>;
  toString(): string; // Serialize a RequestData<CustomQueryType> into string
}
```

When you got an offer, if it acceptable, you should complete the following steps:

1. Validate the offer by calling the `offer.validate()` method. This method will throw an error in case of any troubles. You can enable automatic validation on offers arrival time though a request subscription options
2. Choose an acceptable payment option from the offer
3. Bridge assets to L3 (if required)
4. Make a deal on the offer using the `offer.deal(poId, txClb)`

## Managing funds

```typescript
import { wallet } from '@windingtree/sdk';
```

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
      console.log(`The deal #${tokenId} has been rejected by the supplier ${supplier} with the reason ${reason}`);
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
```
