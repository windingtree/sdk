[![Beta Release](https://github.com/windingtree/sdk/actions/workflows/release.yml/badge.svg?branch=master)](https://github.com/windingtree/sdk/actions/workflows/release.yml)

# @windingtree/sdk

The WindingTree market protocol SDK

> To find the documentation of the SDK please follow the [https://windingtree.github.io/sdk](https://windingtree.github.io/sdk)

## Packages

| Package | Description  | Version |
|---|---|---|
| @windingtree/contracts | Smart contracts and utilities | [![@windingtree/contracts](https://img.shields.io/npm/v/@windingtree/contracts)](https://www.npmjs.com/package/@windingtree/contracts) |
| @windingtree/sdk-server | The protocol coordination server | [![@windingtree/sdk-server](https://img.shields.io/npm/v/@windingtree/sdk-server)](https://www.npmjs.com/package/@windingtree/sdk-server) |
| @windingtree/sdk-node | The protocol node | [![@windingtree/sdk-node](https://img.shields.io/npm/v/@windingtree/sdk-node)](https://www.npmjs.com/package/@windingtree/sdk-node) |
| @windingtree/sdk-node-api | The protocol node management API | [![@windingtree/sdk-node-api](https://img.shields.io/npm/v/@windingtree/sdk-node-api)](https://www.npmjs.com/package/@windingtree/sdk-node-api) |
| @windingtree/sdk-client | The protocol client | [![@windingtree/sdk-client](https://img.shields.io/npm/v/@windingtree/sdk-client)](https://www.npmjs.com/package/@windingtree/sdk-client) |
| @windingtree/sdk-react | React components and utilities | [![@windingtree/sdk-react](https://img.shields.io/npm/v/@windingtree/sdk-react)](https://www.npmjs.com/package/@windingtree/sdk-react) |
| @windingtree/sdk-constants | Constants | [![@windingtree/sdk-constants](https://img.shields.io/npm/v/@windingtree/sdk-constants)](https://www.npmjs.com/package/@windingtree/sdk-constants) |
| @windingtree/sdk-types | The SDK shared Typescript types | [![@windingtree/sdk-types](https://img.shields.io/npm/v/@windingtree/sdk-types)](https://www.npmjs.com/package/@windingtree/sdk-types) |
| @windingtree/sdk-utils | Shared utilities | [![@windingtree/sdk-utils](https://img.shields.io/npm/v/@windingtree/sdk-utils)](https://www.npmjs.com/package/@windingtree/sdk-utils) |
| @windingtree/sdk-test-utils | Test utilities | [![@windingtree/sdk-test-utils](https://img.shields.io/npm/v/@windingtree/sdk-test-utils)](https://www.npmjs.com/package/@windingtree/sdk-test-utils) |
| @windingtree/sdk-pubsub | The protocol pubsub service | [![@windingtree/sdk-pubsub](https://img.shields.io/npm/v/@windingtree/sdk-pubsub)](https://www.npmjs.com/package/@windingtree/sdk-pubsub) |
| @windingtree/sdk-contracts-manager | Smart contracts connection and management | [![@windingtree/sdk-contracts-manager](https://img.shields.io/npm/v/@windingtree/sdk-contracts-manager)](https://www.npmjs.com/package/@windingtree/sdk-contracts-manager) |
| @windingtree/sdk-messages | The protocol messages utilities | [![@windingtree/sdk-messages](https://img.shields.io/npm/v/@windingtree/sdk-messages)](https://www.npmjs.com/package/@windingtree/sdk-messages) |
| @windingtree/sdk-queue | Jobs queue | [![@windingtree/sdk-queue](https://img.shields.io/npm/v/@windingtree/sdk-queue)](https://www.npmjs.com/package/@windingtree/sdk-queue) |
| @windingtree/sdk-storage | Cross-platform storage layer | [![@windingtree/sdk-storage](https://img.shields.io/npm/v/@windingtree/sdk-storage)](https://www.npmjs.com/package/@windingtree/sdk-storage) |
| @windingtree/sdk-db | Databases tools | [![@windingtree/sdk-db](https://img.shields.io/npm/v/@windingtree/sdk-db)](https://www.npmjs.com/package/@windingtree/sdk-db) |
| @windingtree/sdk-logger | Logging utility | [![@windingtree/sdk-logger](https://img.shields.io/npm/v/@windingtree/sdk-logger)](https://www.npmjs.com/package/@windingtree/sdk-logger) |
## Setup

> This repository uses [`pnpm` package manager](https://pnpm.io/installation).

```bash
pnpm install
pnpm build
```

## Testing

```bash
pnpm test
```

After finishing of tests code coverage script, you can find reports in `./coverage/index.html`

## Examples

```bash
pnpm example:server
pnpm example:node
pnpm example:client
# pnpm example:manager
```

> When started the protocol client web-app example will be available on http://localhost:5173 and the node manager app on http://localhost:5174

## Contributing

[Contribution guidelines](https://windingtree.github.io/sdk/#/contribution)
