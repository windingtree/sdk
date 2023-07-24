# @windingtree/sdk-messages

This package offers a way to build, sign and verify offers and requests for Winding Tree market protocol. It takes care of data validation, hashing, and signing/verification of EIP-712 signatures. Additionally, it provides utilities for test environments.

## Installation

```bash
pnpm i @windingtree/sdk-messages
```

## Key Concepts

- **EIP-712 signatures:** Ethereum has a standard for signing structured data, known as EIP-712. This package provides utilities for signing data according to this standard and for verifying such signatures.
- **Offers and requests:** The Winding Tree market protocol operates based on offers and requests. This package includes utilities for creating, signing, and verifying these objects.
- **Data hashing:** Data associated with offers and requests need to be hashed before they can be signed or sent. This package includes utilities for creating these hashes.
- **Expiration time:** Offers and requests can have an expiration time after which they are no longer valid. This package provides a utility for parsing this expiration time.

## Usage

Here is a basic example of how to use this package:

```typescript
import {
  buildRequest,
  buildOffer,
  verifyOffer,
  createCheckInOutSignature,
  Account
} from '@windingtree/sdk-messages';
import { TypedDataDomain } from 'abitype';
import { HDKey, hdKeyToAccount } from 'viem/accounts';
import { polygonZkEvmTestnet } from 'viem/chains';

const domain: TypedDataDomain = { name: 'Market', version: '1.0', chainId: polygonZkEvmTestnet.id };
const supplierId: string = '0x...';
const hdKey = HDKey.fromMasterSeed(...);
const account = hdKeyToAccount(hdKey);

const request = await buildRequest({
  topic: 'test',
  query: {},
  nonce: BigInt(0),
  idOverride: 'customId',
  expire: '1h',
});

const offer = await buildOffer({
  domain,
  supplierId,
  expire: '1h',
  request,
  options: {},
  payment: [],
  cancel: [],
  checkIn: BigInt(1),
  checkOut: BigInt(2),
  account,
});

await verifyOffer({ domain, address: account.address, offer });

const checkInSignature = await createCheckInOutSignature({
  offerId: offer.id,
  domain,
  account,
});
```

## API

This package provides several main functions:

- **buildRequest:** Accepts a `BuildRequestOptions` object and returns a `RequestData` object.
- **buildOffer:** Accepts a `BuildOfferOptions` object and returns an `OfferData` object.
- **verifyOffer:** Accepts a `VerifyOfferArgs` object and checks if an offer signature is valid.
- **createCheckInOutSignature:** Accepts a `CreateCheckInOutSignatureArgs` object and returns a signed EIP-712 hash for a check-in/out voucher.

It also provides several utility functions, mainly for use in tests.

## Testing

```bash
pnpm test
```

## Contributing

[Contribution guidelines](https://windingtree.github.io/sdk/#/docs/contribution)
