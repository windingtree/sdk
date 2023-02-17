# Supplier flow

## Supplier configuration

### Registration

### Owner credential

### Offers signer credentials

### LIF deposit

## Subscribing to requests

## Requests processing

## Building of offer

Every offer structure must follow the generic message data structure proposed by the protocol.

```typescript
// Common message structure
interface GenericMessage {
  id: string; // Unique message Id
  expire: number; // Expiration time in seconds
  nonce?: number; // A number that reflects the version of the message
  [key: string]: unknown;
}

type GenericOfferOptions = Record<string, unknown>;

interface PaymentOption {
  id: string; // Unique payment option Id
  price: string; // Asset price in WEI
  asset: string; // ERC20 asset contract address
}

interface RefundOption {
  id: string; // Unique refund option Id
  time: number; // Seconds before checkIn
  penalty: number; // percents of total
}

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

interface BaseOfferData<OfferOptions extends GenericOfferOptions> {
  supplierId: string; // Unique supplier Id registered on the protocol contract
  options: OfferOptions; // Supplier-specific offer options
  payment: PaymentOption[]; // Payment options
  cancel?: CancelOption[]; // Cancellation options
  transferable: boolean; // makes the deal NFT transferable or not
}

interface OfferData<RequestQuery extends GenericQuery, OfferOptions extends GenericOfferOptions>
  extends GenericMessage,
    BaseOfferData {
  request: RequestData<RequestQuery>; // Copy of associated request
  payload: SignedOffer;
}
```

To build an offer you should use the `buildOffer` method of arrived `request` object.

```typescript
request.buildOffer<BaseOfferData<CustomOfferOptions>>(
  data: BaseOfferData<CustomOfferOptions>,
  expire: string,
  nonce?: number,
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
  // - should validate a query data
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
        id: '79528ee0-0300-4695-926e-065f485ce0c7',
        time: 86400 * 7 * 2, // two week before checkin
        penalty: 50 // 50% penalty
      },
      {
        id: '9b0a55e2-c276-46c7-a310-0c4f6c056070',
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

## Checking for a deal

## Processing a deal

## Checking for refund

## Client checkin

## Funds management
