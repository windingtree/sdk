import { useState, useEffect, useRef } from 'react';
import { Client, ClientOptions, createClient, storage } from '../../../src/index.js'; // @windingtree/sdk
import { RequestQuery, OfferOptions, chainConfig, serverAddress } from '../../shared/index.js';
import { OfferData } from '../../../src/shared/types.js';
import { useWallet } from './providers/WalletProvider/WalletProviderContext.js';
import { AccountWidget } from './providers/WalletProvider/AccountWidget.js';
import { FormValues, RequestForm } from './components/RequestForm.js';
import { Tabs, TabPanel } from './components/Tabs.js';
import { Requests, RequestsRegistryRecord } from './components/Requests.js';
import { MakeDeal } from './components/MakeDeal.js';
import { Offers } from './components/Offers.js';
import { Deals, DealsRegistryRecord } from './components/Deals.js';

/** Default request expiration time */
const defaultExpire = '30s';

/** Default topic to publish requests the same as for the supplier node */
const defaultTopic = 'hello';

/**
 * Main application component
 */
export const App = () => {
  const client = useRef<Client<RequestQuery, OfferOptions> | undefined>();
  const { publicClient } = useWallet();
  const [connected, setConnected] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const [requests, setRequests] = useState<RequestsRegistryRecord[]>([]);
  const [deals, setDeals] = useState<DealsRegistryRecord[]>([]);
  const [offers, setOffers] = useState<OfferData<RequestQuery, OfferOptions>[] | undefined>();
  const [offer, setOffer] = useState<OfferData<RequestQuery, OfferOptions> | undefined>();
  const [error, setError] = useState<string | undefined>();

  /** This hook starts the client that will be available via `client.current` */
  useEffect(() => {
    const startClient = async () => {
      try {
        setError(undefined);

        const options: ClientOptions = {
          chain: chainConfig,
          serverAddress,
          storageInitializer: storage.localStorage.createInitializer({
            session: false, // session or local storage
          }),
          dbKeysPrefix: 'wt_',
          publicClient,
        };

        const updateRequests = () => {
          if (client.current) {
            setRequests(client.current.requests.getAll());
          }
        };

        const updateDeals = () => {
          if (client.current) {
            client.current.deals.getAll().then((newDeals) => {
              setDeals(newDeals);
            }).catch(console.error);
          }
        };

        client.current = createClient<RequestQuery, OfferOptions>(options);

        client.current.addEventListener('start', () => {
          console.log('🚀 Client started at:', new Date().toISOString());
          updateRequests();
          updateDeals();
        });

        client.current.addEventListener('stop', () => {
          console.log('👋 Client stopped at:', new Date().toISOString());
        });

        client.current.addEventListener('connected', () => {
          setConnected(true);
          console.log('🔗 Client connected to server at:', new Date().toISOString());
        });

        client.current.addEventListener('disconnected', () => {
          setConnected(false);
          console.log('🔌 Client disconnected from server at:', new Date().toISOString());
        });

        /** Listening for requests events and update tables */
        client.current.addEventListener('request:create', updateRequests);
        client.current.addEventListener('request:subscribe', updateRequests);
        client.current.addEventListener('request:publish', updateRequests);
        client.current.addEventListener('request:unsubscribe', updateRequests);
        client.current.addEventListener('request:expire', updateRequests);
        client.current.addEventListener('request:cancel', updateRequests);
        client.current.addEventListener('request:delete', updateRequests);
        client.current.addEventListener('request:offer', updateRequests);
        client.current.addEventListener('request:clear', updateRequests);
        client.current.addEventListener('deal:changed', updateDeals);

        await client.current.start();
      } catch (error) {
        console.log(error);
        setError('Something went wrong...');
      }
    };

    startClient();
  }, [publicClient]);

  /** Publishing of request */
  const sendRequest = async ({ topic, message }: FormValues) => {
    try {
      setError(undefined);

      if (!client.current) {
        throw new Error('The client is not initialized yet');
      }

      const request = await client.current.requests.create({
        topic,
        expire: defaultExpire,
        nonce: BigInt(1),
        query: {
          greeting: message,
        },
      });

      client.current.requests.publish(request);
    } catch (error) {
      console.log('@@@', error);
      setError((error as Error).message);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <h1>Client</h1>
        </div>
        <AccountWidget />
      </div>
      {client.current && <div>✅ Client started</div>}
      {connected && <div>✅ Connected to the coordination server</div>}
      <RequestForm connected={connected} onSubmit={sendRequest} defaultTopic={defaultTopic} />
      <Tabs
        tabs={[
          {
            id: 0,
            title: 'Requests',
            active: true,
          },
          {
            id: 1,
            title: 'Deals',
          },
        ]}
        onChange={setSelectedTab}
      />
      <TabPanel id={0} activeTab={selectedTab}>
        <Requests
          requests={requests}
          subscribed={(id) => client.current?.requests.subscribed(id) || false}
          onClear={() => {
            if (client.current) {
              client.current?.requests.clear();
            }
          }}
          onCancel={(id) => {
            if (client.current) {
              client.current.requests.cancel(id);
            }
          }}
          onOffers={setOffers}
        />
        <Offers
          offers={offers}
          onAccept={setOffer}
          onClose={() => {
            setOffer(undefined);
            setOffers(undefined);
          }}
        />
        <MakeDeal offer={offer} client={client.current} />
      </TabPanel>
      <TabPanel id={1} activeTab={selectedTab}>
        <Deals deals={deals} client={client.current} />
      </TabPanel>

      {error && <div style={{ marginTop: 20 }}>🚨 {error}</div>}
    </>
  );
};
