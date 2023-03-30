# Examples

> To enable console logging you can use [DEBUG](https://github.com/debug-js/debug#readme) utility features

## Coordination server

The coordination server example application can be started using the command:

```bash
yarn examples:server
DEBUG=* yarn examples:server
DEBUG={moduleName:*} yarn examples:server
DEBUG={moduleName:trace|error} yarn examples:server
```

## Protocol client

React based web-app that allows to send simple requests and obtain offers from the supplier in response. To start it use this command:

```bash
yarn examples:client
```

## Supplier node

Node.js based application:

```bash
yarn examples:node
```
