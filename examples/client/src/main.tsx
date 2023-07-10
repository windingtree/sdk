import { createRoot } from 'react-dom/client';
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
  <WalletProvider>
    <App />
  </WalletProvider>,
);
