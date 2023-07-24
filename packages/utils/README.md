# @windingtree/sdk-utils

The `@windingtree/sdk-utils` package provides a collection of helper utilities that are used throughout the Winding Tree SDK. It includes functions for working with H3 spatial indexing, text encoding and decoding, time calculations and conversions, generating unique identifiers (UIDs), and Ethereum wallet operations.

## Installation

```bash
pnpm i @windingtree/sdk-utils
```

## Key Functions

This package provides several key utility functions:

- H3 functions for converting latitude/longitude points to H3 indexes and vice versa
- Text encoding and decoding functions
- Time utilities for parsing formatted string durations into seconds, calculating backoff with jitter, and checking if a timestamp has expired
- Unique identifier (UID) utilities
- Wallet functions for generating mnemonics and deriving accounts from them

## Usage

You can import individual utilities from the package as needed. For example:

```typescript
import { parseSeconds, nowSec, isExpired } from '@windingtree/sdk-utils';

const duration = parseSeconds('2h');
const currentTime = nowSec();
const expired = isExpired(BigInt(currentTime + Number(duration)));
```

## Documentation

For full documentation and examples, visit [windingtree.github.io/sdk](https://windingtree.github.io/sdk)

## Testing

```bash
pnpm test
```

## Contributing

[Contribution guidelines](https://windingtree.github.io/sdk/#/docs/contribution)
