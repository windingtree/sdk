import { createRoot } from 'react-dom/client';
import { ConfigProvider } from './providers/ConfigProvider/index.js';
import { NodeProvider } from './providers/NodeProvider/index.js';
import { WalletProvider } from '../../react-libs/src/providers/WalletProvider/index.js';
import { App } from './App';

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
        <App />
      </WalletProvider>
      ,
    </NodeProvider>
  </ConfigProvider>,
);
