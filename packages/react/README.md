# @windingtree/sdk-react

This package provides a collection of React context providers and hooks that abstract the interaction with the Winding Tree SDK and blockchain related functionality.

## Installation

```bash
pnpm i @windingtree/sdk-react
```

## Key concepts

The package consists of several main elements:

- `ConfigProvider`: Manages the application's configuration stored in local storage.
- `ContractsProvider`: Utilizes the `@windingtree/sdk-contracts-manager` package to manage the application's contracts.
- `NodeProvider`: Connects to the Winding Tree Node using a TRPC client, provided by the `@trpc/client` package.
- `WalletProvider`: Uses the `viem` library to interact with the user's wallet (such as MetaMask) and manage the wallet state.

All these providers are designed to be used with React's Context API, providing a simple and idiomatic way to use Winding Tree SDK with a React application.

## Usage

The providers can be imported directly from the package:

```typescript
import { createRoot } from 'react-dom/client';
import { Hash } from 'viem';
import { App } from './App.js';
import { ConfigProvider, NodeProvider, WalletProvider, ContractsProvider } from '@windingtree/sdk-react/providers';
import { polygonZkEvmTestnet } from 'viem/chains';
import { contractsConfig } from 'wtmp-protocol-examples-shared-files/dist/index.js';

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <ConfigProvider>
    <NodeProvider>
      <WalletProvider targetChain={polygonZkEvmTestnet}>
        <ContractsProvider contractsConfig={contractsConfig}>
          <App />
        </ContractsProvider>
      </WalletProvider>
    </NodeProvider>
  </ConfigProvider>,
);
```

Then these providers can be used inside components:

```typescript
import { useConfig, useNode, useWallet } from '@windingtree/sdk-react/providers';

export const Widget = () => {
  const { isAuth, login, setAuth, resetAuth } = useConfig();
  const { node, nodeConnected } = useNode();
  const { isConnected, walletClient } = useWallet();
  /** ... */
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
