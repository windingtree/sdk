import { createRoot } from 'react-dom/client';
import { Hash } from 'viem';
import { AppConfig, ConfigProvider } from './providers/ConfigProvider/index.js';
import { NodeProvider } from './providers/NodeProvider/index.js';
import { WalletProvider } from '../../react-libs/src/providers/WalletProvider/index.js';
import { ContractProvider } from '../../react-libs/src/providers/ContractsProvider/index.js';
import { App } from './App';

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
      <WalletProvider>
        <ContractProvider>
          <App />
        </ContractProvider>
      </WalletProvider>
    </NodeProvider>
  </ConfigProvider>,
);
