import { useState, useEffect } from 'react';
import { EventHandler } from '@libp2p/interface/events';
import { ClientRequestRecord } from '@windingtree/sdk-client';
import { buildRequest } from '@windingtree/sdk-messages';
import { RequestQuery, OfferOptions } from 'wtmp-examples-shared-files';
import { OfferData, RequestData } from '@windingtree/sdk-types';
import {
  AccountWidget,
  useClient,
  useRequestsManager,
  useDealsManager,
} from '@windingtree/sdk-react/providers';
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
  const { client, clientConnected } = useClient<RequestQuery, OfferOptions>();
  const { requestsManager } = useRequestsManager<RequestQuery, OfferOptions>();
  const { dealsManager } = useDealsManager<RequestQuery, OfferOptions>();
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

  useEffect(() => {
    const updateRequests = () => {
      setRequests(() => requestsManager?.getAll() || []);
    };

    const updateDeals = () => {
      dealsManager
        ?.getAll()
        .then((newDeals) => {
          setDeals(() => newDeals);
        })
        .catch(console.error);
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
      console.log(
        '🔗 Client connected to server at:',
        new Date().toISOString(),
      );

      requestsManager?.refreshSubscriptions();
    };

    const onClientDisconnected = () => {
      console.log(
        '🔌 Client disconnected from server at:',
        new Date().toISOString(),
      );
    };

    const onRequestPublish: EventHandler<
      CustomEvent<RequestData<RequestQuery>>
    > = ({ detail }) => {
      requestsManager?.add(detail);
    };

    const onOffer: EventHandler<
      CustomEvent<OfferData<RequestQuery, OfferOptions>>
    > = ({ detail }) => {
      requestsManager?.addOffer(detail);
    };

    const onRequestSubscribe: EventHandler<
      CustomEvent<ClientRequestRecord>
    > = ({ detail }) => {
      client.subscribe(detail.data.id);
    };

    const onRequestUnsubscribe: EventHandler<
      CustomEvent<ClientRequestRecord>
    > = ({ detail }) => {
      client.unsubscribe(detail.data.id);
    };

    client.addEventListener('start', onClientStart);
    client.addEventListener('stop', onClientStop);
    client.addEventListener('connected', onClientConnected);
    client.addEventListener('disconnected', onClientDisconnected);
    client.addEventListener('publish', onRequestPublish);
    client.addEventListener('offer', onOffer);

    requestsManager?.addEventListener('request', updateRequests);
    requestsManager?.addEventListener('expire', updateRequests);
    requestsManager?.addEventListener('cancel', updateRequests);
    requestsManager?.addEventListener('delete', updateRequests);
    requestsManager?.addEventListener('clear', updateRequests);
    requestsManager?.addEventListener('offer', updateRequests);
    requestsManager?.addEventListener('subscribe', onRequestSubscribe);
    requestsManager?.addEventListener('unsubscribe', onRequestUnsubscribe);

    dealsManager?.addEventListener('changed', updateDeals);

    client.start().catch(console.error);

    return () => {
      client.removeEventListener('start', onClientStart);
      client.removeEventListener('stop', onClientStop);
      client.removeEventListener('connected', onClientConnected);
      client.removeEventListener('disconnected', onClientDisconnected);
      client.removeEventListener('publish', onRequestPublish);
      client.removeEventListener('offer', onOffer);

      requestsManager?.removeEventListener('request', updateRequests);
      requestsManager?.removeEventListener('expire', updateRequests);
      requestsManager?.removeEventListener('cancel', updateRequests);
      requestsManager?.removeEventListener('delete', updateRequests);
      requestsManager?.removeEventListener('clear', updateRequests);
      requestsManager?.removeEventListener('offer', updateRequests);
      requestsManager?.removeEventListener('subscribe', onRequestSubscribe);
      requestsManager?.removeEventListener('unsubscribe', onRequestUnsubscribe);

      dealsManager?.removeEventListener('changed', updateDeals);

      client.stop().catch(console.error);
      dealsManager?.stop();
    };
  }, [client, requestsManager, dealsManager]);

  /** Publishing of request */
  const sendRequest = async ({ topic, message }: FormValues) => {
    try {
      setError(undefined);

      if (!client) {
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

      client.publish(request);
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
      {client && <div>✅ Client started</div>}
      {clientConnected && <div>✅ Connected to the coordination server</div>}
      <RequestForm
        connected={clientConnected}
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
          subscribed={(id) => requestsManager?.get(id)?.subscribed || false}
          onClear={() => {
            requestsManager?.clear();
          }}
          onCancel={(id) => {
            if (client) {
              requestsManager?.cancel(id);
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
        <MakeDeal offer={offer} manager={dealsManager} />
      </TabPanel>
      <TabPanel id={1} activeTab={selectedTab}>
        <Deals deals={deals} manager={dealsManager} />
      </TabPanel>

      {error && <div style={{ marginTop: 20 }}>🚨 {error}</div>}
    </>
  );
};
