import { createRoot } from 'react-dom/client';
import { Hash } from 'viem';
import { App } from './App.js';
import { AppConfig, ConfigProvider, NodeProvider, WalletProvider, ContractsProvider } from '@windingtree/sdk-react/providers';
import { hardhat, polygonZkEvmTestnet } from 'viem/chains';
import { contractsConfig } from 'wtmp-protocol-examples-shared-files/dist/index.js';

const targetChain = import.meta.env.VITE_LOCAL_NODE === 'hardhat'
  ? hardhat
  : polygonZkEvmTestnet;

export interface CustomConfig extends AppConfig {
  supplierId?: Hash;
}

window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  event.stopPropagation();
  // eslint-disable-next-line no-console
  console.log('Unhandled error event', event);
});

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <ConfigProvider>
    <NodeProvider>
      <WalletProvider targetChain={targetChain}>
        <ContractsProvider contractsConfig={contractsConfig}>
          <App />
        </ContractsProvider>
      </WalletProvider>
    </NodeProvider>
  </ConfigProvider>,
);
