# Examples

Below are examples of how to run various applications related to the WindingTree market protocol SDK.

> To enable console logging, you can use the [DEBUG](https://github.com/debug-js/debug#readme) utility features.

## Coordination Server

To run the coordination server example application, use the following commands:

```bash
pnpm examples:server
```

To enable debug logging, use one of the following commands:

```bash
DEBUG=* pnpm examples:server
```

```bash
DEBUG={moduleName:*} pnpm examples:server
```

```bash
DEBUG={moduleName:trace|error} pnpm examples:server
```

## Protocol Client

The protocol client is a React-based web application that allows users to send simple requests and obtain offers from suppliers in response. To start the client, use the following command:

```bash
pnpm examples:client
```

When the client is started, it can be accessed in the browser at the address: https://localhost:5173

## Supplier Node

The supplier node is a Node.js-based application that can be started using the following command:

```bash
pnpm examples:node
```

## Node Manager

The node manager is a React-based web application that allows users to register supplier entities in the protocol smart contract and provides simple supplier reception features, such as reviewing existing deals, making user check-in and check-out operations. To start the node manager, use the following command:

```bash
pnpm examples:manager
```

When the node manager is started, it can be accessed in the browser at the address: https://localhost:5174

Please note that you may need to have the required dependencies installed and properly configured to run these examples. Make sure to follow the instructions provided in the SDK documentation or example files for setting up and running these applications.
