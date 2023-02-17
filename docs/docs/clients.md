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

## Subscription to clients' events

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
  subscribe<CustomOfferType>(async function({ message: CustomOfferType }): Promise<void>, OffersSubscriptionOptions): void;
  unsubscribe(): void;
  toString(): string; // Serialize a RequestData<CustomRequestQuery> into string
  hash(): string; // Standardized has of the serialized object data
}
```

The `Request` object exposed the following methods:

- `change(data, expire)`: allows to change the request data and expiration time
- `subscribe(callback, options)`: creates subscription to offers associated with the request
- `unsubscribe()`: removes the subscription to offers
- `toString()`: serializes the request object
- `hash()`: creates a standardized hash of the serialized object data

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
const chainId = 137;
const address = '0x...';
const balance = await client.wallet.balance(chainId, address);
```

### Bridging assets

```typescript
await client.bridge('polygon', '0x..', '100000000000000000000', (txHash) => {
  console.log(`Tokens bridging: ${txHash}`);
});
console.log('Tokens bridged, check your balance on target network');
```

### Exiting assets

```typescript
await client.exit('polygon', '0x..', '100000000000000000000', (txHash) => {
  console.log(`Tokens exiting: ${txHash}`);
});
console.log('Tokens exited, check your balance on target network');
```

## Making a deal

```typescript
const deal = await offer.deal('1cf51a15-da09-4a68-929d-84e60901ca0f', (txHash) => {
  console.log(`Making a deal: ${txHash}`);
});
console.log('Success! Start waiting for the confirmation from the supplier');
```

## Checking a deal state

```typescript
import { DEAL_CLAIMED, DEAL_REJECTED } from '@windingtree/sdk/constants';

const tokenId = await deal.subscribe(({ id, supplier, result, reason }) => {
  switch (result) {
    case DEAL_REJECTED:
      console.log(`The deal #${id} has been rejected by the supplier ${supplier} with the reason ${reason}`);
      break;
    case DEAL_CLAIMED:
      console.log(`The deal #${id} has been confirmed by the supplier ${supplier}`);
    default:
      console.log('Unknown deal response');
  }
});

// To check the deal state later
const { id, supplier, result, reason } = await client.deal(chainId, tokenId);
```

## Checkin

## Cancellation
