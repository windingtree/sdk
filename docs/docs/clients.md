# Client flow

## Create the protocol client

More about the client configuration options is [here](./index.md#client-node).

```typescript
import { ClientOptions, createClient } from '@windingtree/sdk';
import { RequestQuery, OfferOptions } from './config.js';

const options: ClientOptions<RequestQuery, OfferOptions> = {
  /*...*/
};

const client = createClient<RequestQuery, OfferOptions>(options);
await client.start(); // Start the client
await client.stop(); // Stop the client
```

## Subscription to client's events

A client allows subscribing to the following event types.

- `start`: emitted when the client is started
- `stop`: emitted when the client is stopped
- `connected`: emitted when the client is connected to the coordination server
- `disconnected`: emitted when the client is disconnected
- `heartbeat`: emitted every second, useful for performing utility functions

Requests events scope:

- `request:create`: emitted when a request is created
- `request:publish`: emitted when a request is published
- `request:subscribe`: emitted when a request is subscribe to offers
- `request:unsubscribe`: emitted when a request is unsubscribed
- `request:expire`: emitted when a request is expired
- `request:cancel`: emitted when a request is cancelled
- `request:delete`: emitted when a request is deleted from registry
- `request:offer`: emitted when offer on a request is received
- `request:clear`: emitted when the request registry is cleared

```typescript
client.addEventListener('start', () => {
  console.log('Started!');
});

client.addEventListener('stop', () => {
  console.log('Stopped!');
});
```

## Building of request

Every request structure must follow the generic message data structure proposed by the protocol.

```typescript
type GenericQuery = Record<string, unknown>;

/**
 * Common message structure
 */
interface GenericMessage {
  /** Unique message Id */
  id: string;
  /** Expiration time in seconds */
  expire: number;
  /** A number that reflects the version of the message */
  nonce: number;
}

/**
 * Request data structure
 */
interface RequestData<RequestQuery extends GenericQuery> extends GenericMessage {
  /** Industry specific query type */
  query: RequestQuery;
}
```

The protocol SDK uses the `zod` library for data structures validation. Ready-made data structures validation schemes and static typescript types can be imported from the SDK module.

```typescript
import { z } from 'zod';
import { GenericQuerySchema, createRequestDataSchema, RequestData } from '@windingtree/sdk';

/**
 * Custom query schema
 */
const MyCustomRequestQuerySchema = GenericQuerySchema.extend({
  howMuch: z.number(),
});

type MyCustomRequestQuery = z.infer<typeof MyCustomRequestQuerySchema>;

const request: RequestData<MyCustomRequestQuery> = {
  /** ... */
  query: {
    howMuch: 10,
  },
};

const requestSchema = createRequestDataSchema<typeof MyCustomRequestQuerySchema>(
  MyCustomRequestQuerySchema,
);

// the `parse` method of schema is validating an object according to the schema rules
const { query } = requestSchema.parse(request);
console.log(query);
// {
//   howMuch: 10,
// }
```

To build a request you can use the `requests.create` method of the client instance.

```typescript
const request = await client.requests.create({
  topic: 'hello',
  expire: '1m', // 1 minute
  nonce: 1,
  query: {
    howMuch: 10,
  },
});
console.log(request);
// {
//   id: '27ef525f-2521-43c6-9e70-d9a12a37d532',
//   expire: 1680258961,
//   nonce: 1,
//   topic: 'hello',
//   query: {
//     howMuch: 10
//   };
// }
```

## Subscribing to offers

The protocol client automatically publishes the request when it is added to the requests management registry. You should use `requests.publish` method of the client instance to publish your request.

```typescript
client.addEventListener('request.publish', ({ detail: id }) => {
  console.log(`Request #${id} is published`);
});

client.requests.publish(request);

// Request #27ef525f-2521-43c6-9e70-d9a12a37d532 is published
```

## Requests API

Here are the available methods of the clients' requests AP

- `create`: Creates a new request

```typescript
const request = await client.request.create({
  /** RequestData<RequestQuery> */
});
```

- `publish`: Publishes the request

```typescript
client.request.publish(request);
```

- `get`: Returns request registry record:

```typescript
type RequestRecord<RequestQuery, OfferOptions> = {
  /** Request data */
  data: RequestData<RequestQuery>;
  /** Received offers */
  offers: OfferData<RequestQuery, OfferOptions>[];
};
```

```typescript
const requestRecord = await client.request.get(request.id);
```

- `getAll`: Returns an array of all registered request records
- `cancel`: Cancels the request subscription. Offers for this request will not be accepted.
- `delete`: Removes the request from the client registry
- `clear`: Removes all requests from the registry
- `subscribed`: Checks if request is currently subscribed by its Id

## Processing offers

An offer data type is describe [here](/docs/nodes.md#building-and-publishing-of-offer).

All received offers are automatically added to the registry and accessible via the `offers` property of the associated request record.

To get all offers from registry you need to fetch a request record using `get` method.

```typescript
const { offers } = client.requests.get(request.id);
```

Every time a new offer is received the client emits a `request:offer` event. You can use this event to support your local environment up to date.

```typescript
import { useEffect, useRef } from 'react';

const OffersList = ({ client }: { client: Client<RequestQuery, OfferOptions> }) => {
  const offers = useRef();

  useEffect(() => {
    /** Initialization of the component */
    offers.current = new Map<string, OfferData<RequestQuery, OfferOptions>>(
      client.requests.getAll().reduce((a, v) => [...a, [v.data.id, v.offers]], []),
    );

    /** Manage up-to-date state */
    client.addEventListener('request:offer', ({ details: id }) => {
      console.log(`Received an offer to request #${id}`);
      const { offers } = client.requests.get(request.id);
      offers.current.set(id, offers ?? []);
    });
  });

  return (
    <table>
      {[...(offers?.current.entries() ?? [])].map(
        ((record, i) = (
          <tr key={i}>
            <td>{record[0]}</td>
            <td>{record[1].length}</td>
          </tr>
        )),
      )}
    </table>
  );
};
```

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
