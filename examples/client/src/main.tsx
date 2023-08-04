import { createRoot } from 'react-dom/client';
import {
  WalletProvider,
  ClientProvider,
  RequestsManagerProvider,
  DealsManagerProvider,
} from '@windingtree/sdk-react/providers';
import { polygonZkEvmTestnet, hardhat } from 'viem/chains';
import {
  RequestQuery,
  OfferOptions,
  serverAddress,
  contractsConfig,
} from 'wtmp-examples-shared-files';
import {
  LocalStorage,
  createInitializer,
} from '@windingtree/sdk-storage/local';
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
    <ClientProvider<RequestQuery, OfferOptions> serverAddress={serverAddress}>
      <RequestsManagerProvider<RequestQuery, OfferOptions, LocalStorage>
        storageInitializer={createInitializer({
          session: false, // session or local storage
        })}
        prefix={'wt_requests_'}
      >
        <DealsManagerProvider<RequestQuery, OfferOptions, LocalStorage>
          storageInitializer={createInitializer({
            session: false, // session or local storage
          })}
          prefix={'wt_deals_'}
          checkInterval={'5s'}
          chain={targetChain}
          contracts={contractsConfig}
        >
          <App />
        </DealsManagerProvider>
      </RequestsManagerProvider>
    </ClientProvider>
  </WalletProvider>,
);
