import { createRoot } from 'react-dom/client';
import { WalletProvider } from '@windingtree/sdk-react/providers';
import { polygonZkEvmTestnet, hardhat } from 'viem/chains';
import { App } from './App.js';

const targetChain =
  import.meta.env.VITE_LOCAL_NODE === 'hardhat' ? hardhat : polygonZkEvmTestnet;

window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  event.stopPropagation();
  // eslint-disable-next-line no-console
  console.log('Unhandled error event', event);
});

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <WalletProvider targetChain={targetChain}>
    <App />
  </WalletProvider>,
);
