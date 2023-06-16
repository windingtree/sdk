import { useState, useEffect, useRef } from 'react';
import { hardhat, polygonZkEvmTestnet } from 'viem/chains';
import { EventHandler } from '@libp2p/interfaces/events';
import {
  Client,
  ClientOptions,
  createClient,
  storage,
  ClientRequestsManager,
  buildRequest,
  ClientDealsManager,
  ClientRequestRecord,
} from '../../../src/index.js'; // @windingtree/sdk
import {
  RequestQuery,
  OfferOptions,
  contractsConfig,
  serverAddress,
} from '../../shared/index.js';
import { OfferData, RequestData } from '../../../src/shared/types.js';
import { useWallet } from './providers/WalletProvider/WalletProviderContext.js';
import { AccountWidget } from './providers/WalletProvider/AccountWidget.js';
import { FormValues, RequestForm } from './components/RequestForm.js';
import { Tabs, TabPanel } from './components/Tabs.js';
import { Requests, RequestsRegistryRecord } from './components/Requests.js';
import { MakeDeal } from './components/MakeDeal.js';
import { Offers } from './components/Offers.js';
import { Deals, DealsRegistryRecord } from './components/Deals.js';

/** Target chain config */
const chain =
  import.meta.env.LOCAL_NODE === 'true' ? hardhat : polygonZkEvmTestnet;

/** Default request expiration time */
const defaultExpire = '30s';

/** Default topic to publish requests the same as for the supplier node */
const defaultTopic = 'hello';

/**
 * Main application component
 */
export const App = () => {
  const client = useRef<Client<RequestQuery, OfferOptions> | undefined>();
  const requestsManager = useRef<
    ClientRequestsManager<RequestQuery, OfferOptions> | undefined
  >();
  const dealsManager = useRef<ClientDealsManager<RequestQuery, OfferOptions>>();
  const { publicClient } = useWallet();
  const [connected, setConnected] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const [requests, setRequests] = useState<RequestsRegistryRecord[]>([]);
  const [deals, setDeals] = useState<DealsRegistryRecord[]>([]);
  const [offers, setOffers] = useState<
    OfferData<RequestQuery, OfferOptions>[] | undefined
  >();
  const [offer, setOffer] = useState<
    OfferData<RequestQuery, OfferOptions> | undefined
  >();
  const [error, setError] = useState<string | undefined>();

  /** This hook starts the client that will be available via `client.current` */
  useEffect(() => {
    const updateRequests = () => {
      setRequests(requestsManager.current?.getAll() || []);
    };

    const updateDeals = () => {
      if (dealsManager.current) {
        dealsManager.current
          .getAll()
          .then((newDeals) => {
            setDeals(newDeals);
          })
          .catch(console.error);
      }
    };

    const onClientStart = () => {
      console.log('🚀 Client started at:', new Date().toISOString());
      updateRequests();
      updateDeals();
    };

    const onClientStop = () => {
      console.log('👋 Client stopped at:', new Date().toISOString());
    };

    const onClientConnected = () => {
      setConnected(true);
      console.log(
        '🔗 Client connected to server at:',
        new Date().toISOString(),
      );
    };

    const onClientDisconnected = () => {
      setConnected(false);
      console.log(
        '🔌 Client disconnected from server at:',
        new Date().toISOString(),
      );
    };

    const onRequestSubscribe: EventHandler<
      CustomEvent<ClientRequestRecord>
    > = ({ detail }) => {
      client.current?.subscribe(detail.data.id);
    };

    const onRequestUnsubscribe: EventHandler<
      CustomEvent<ClientRequestRecord>
    > = ({ detail }) => {
      client.current?.unsubscribe(detail.data.id);
    };

    const onRequestPublish: EventHandler<
      CustomEvent<RequestData<RequestQuery>>
    > = ({ detail }) => {
      requestsManager.current?.add(detail);
    };

    const onOffer: EventHandler<
      CustomEvent<OfferData<RequestQuery, OfferOptions>>
    > = ({ detail }) => {
      requestsManager.current?.addOffer(detail);
    };

    const startClient = async () => {
      try {
        setError(undefined);

        const storageInitializer = storage.localStorage.createInitializer({
          session: false, // session or local storage
        });

        const store = await storageInitializer();

        requestsManager.current = new ClientRequestsManager<
          RequestQuery,
          OfferOptions
        >({
          storage: store,
          prefix: 'wt_requests_',
        });

        dealsManager.current = new ClientDealsManager<
          RequestQuery,
          OfferOptions
        >({
          storage: store,
          prefix: 'wt_deals_',
          checkInterval: '5s',
          chain,
          contracts: contractsConfig,
          publicClient,
        });

        client.current = createClient<RequestQuery, OfferOptions>({
          serverAddress,
        });

        client.current.addEventListener('start', onClientStart);
        client.current.addEventListener('stop', onClientStop);
        client.current.addEventListener('connected', onClientConnected);
        client.current.addEventListener('disconnected', onClientDisconnected);
        client.current.addEventListener('publish', onRequestPublish);
        client.current.addEventListener('offer', onOffer);

        requestsManager.current.addEventListener('request', updateRequests);
        requestsManager.current.addEventListener('expire', updateRequests);
        requestsManager.current.addEventListener('cancel', updateRequests);
        requestsManager.current.addEventListener('delete', updateRequests);
        requestsManager.current.addEventListener('clear', updateRequests);
        requestsManager.current.addEventListener('offer', updateRequests);
        requestsManager.current.addEventListener(
          'subscribe',
          onRequestSubscribe,
        );
        requestsManager.current.addEventListener(
          'unsubscribe',
          onRequestUnsubscribe,
        );

        dealsManager.current.addEventListener('changed', updateDeals);

        await client.current.start();
      } catch (error) {
        console.log(error);
        setError('Something went wrong...');
      }
    };

    const stopClient = async () => {
      client.current?.stop();
    };

    startClient();

    return () => {
      client.current?.removeEventListener('start', onClientStart);
      client.current?.removeEventListener('stop', onClientStop);
      client.current?.removeEventListener('connected', onClientConnected);
      client.current?.removeEventListener('disconnected', onClientDisconnected);
      client.current?.removeEventListener('publish', onRequestPublish);
      client.current?.removeEventListener('offer', onOffer);

      requestsManager.current?.removeEventListener('request', updateRequests);
      requestsManager.current?.removeEventListener('expire', updateRequests);
      requestsManager.current?.removeEventListener('cancel', updateRequests);
      requestsManager.current?.removeEventListener('delete', updateRequests);
      requestsManager.current?.removeEventListener('clear', updateRequests);
      requestsManager.current?.removeEventListener('offer', updateRequests);
      requestsManager.current?.removeEventListener(
        'subscribe',
        onRequestSubscribe,
      );
      requestsManager.current?.removeEventListener(
        'unsubscribe',
        onRequestUnsubscribe,
      );

      dealsManager.current?.removeEventListener('changed', updateDeals);

      stopClient().catch(console.error);
      dealsManager.current?.stop();
    };
  }, [publicClient]);

  /** Publishing of request */
  const sendRequest = async ({ topic, message }: FormValues) => {
    try {
      setError(undefined);

      if (!client.current) {
        throw new Error('The client is not initialized yet');
      }

      const request = await buildRequest<RequestQuery>({
        topic,
        expire: defaultExpire,
        nonce: BigInt(1),
        query: {
          greeting: message,
        },
      });

      client.current.publish(request);
    } catch (error) {
      console.log('@@@', error);
      setError((error as Error).message);
    }
  };

  return (
    <>
      <div
        style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}
      >
        <div style={{ flex: 1 }}>
          <h1>Client</h1>
        </div>
        <AccountWidget />
      </div>
      {client.current && <div>✅ Client started</div>}
      {connected && <div>✅ Connected to the coordination server</div>}
      <RequestForm
        connected={connected}
        onSubmit={sendRequest}
        defaultTopic={defaultTopic}
      />
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
          subscribed={(id) =>
            requestsManager.current?.get(id)?.subscribed || false
          }
          onClear={() => {
            requestsManager.current?.clear();
          }}
          onCancel={(id) => {
            if (client.current) {
              requestsManager.current?.cancel(id);
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
        <MakeDeal offer={offer} manager={dealsManager.current} />
      </TabPanel>
      <TabPanel id={1} activeTab={selectedTab}>
        <Deals deals={deals} manager={dealsManager.current} />
      </TabPanel>

      {error && <div style={{ marginTop: 20 }}>🚨 {error}</div>}
    </>
  );
};
