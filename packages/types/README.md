# @windingtree/sdk-types

The `@windingtree/sdk-types` package provides a collection of TypeScript interfaces and types which are commonly used across the Winding Tree SDK. It includes data types for messages, requests, offers, deals, contracts, and various configuration options.

## Installation

```bash
pnpm i @windingtree/sdk-types
```

## Key concepts

This package encapsulates a variety of data types used across the SDK:

- Message, Request, Offer, and Deal types: These provide structure for core data transactions within the SDK.
- ContractConfig and Contracts: These interfaces define configurations for interacting with Ethereum smart contracts.
- PaginationOptions: This interface is used for paged responses in some methods.
- Other utility types such as NodeKeyJson, PeerOptions, ChainsConfigOption, NoncePeriodOption and more.

## Usage

These types are generally used for type checking purposes within the SDK and might not be directly interacted with during typical usage of the SDK. They are imported when needed for type annotations in TypeScript files.

```typescript
import { RequestData, GenericQuery } from '@windingtree/sdk-types';

const requestData: RequestData<GenericQuery> = {
  // populate data here
};
```

## Documentation

For full documentation and examples, visit [windingtree.github.io/sdk](https://windingtree.github.io/sdk)

## Testing

```bash
pnpm test
```

## Contributing

[Contribution guidelines](https://windingtree.github.io/sdk/#/docs/contribution)
