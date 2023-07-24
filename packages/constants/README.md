# @windingtree/sdk-constants

This package is a part of the Winding Tree SDK. It provides a set of predefined constants that are commonly used throughout the Winding Tree market protocol implementations. This package facilitates consistent timing and configuration across various aspects of the protocol, such as message expiration times, outbound stream delays, nonce periods, queue job parameters, and more.

## Installation

```bash
pnpm i @windingtree/sdk-constants
```

## Usage

Here's a basic example of how to use this package:

```typescript
import {
  defaultExpirationTime,
  outboundStreamDelay,
  noncePeriod,
  queueConcurrentJobsNumber,
  queueJobAttemptsDelay,
  queueHeartbeat
} from '@windingtree/sdk-constants';

console.log('Default Expiration Time:', defaultExpirationTime);
console.log('Outbound Stream Delay:', outboundStreamDelay);
console.log('Nonce Period:', noncePeriod);
console.log('Queue Concurrent Jobs Number:', queueConcurrentJobsNumber);
console.log('Queue Job Attempts Delay:', queueJobAttemptsDelay);
console.log('Queue Heartbeat:', queueHeartbeat);
```

This will log the values of various constants to the console.

## Documentation

For full documentation and examples, visit [windingtree.github.io/sdk](https://windingtree.github.io/sdk)

## Testing

```bash
pnpm test
```

## Contributing

[Contribution guidelines](https://windingtree.github.io/sdk/#/docs/contribution)
