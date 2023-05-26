import { useState, useEffect, useRef, useCallback } from 'react';
import { Hash } from 'viem';
import {
  Client,
  ClientOptions,
  RequestRecord,
  createClient,
  storage,
  utils,
} from '../../../src/index.js'; // @windingtree/sdk
import { RequestQuery, OfferOptions, chainConfig, serverAddress } from '../../shared/index.js';
import { OfferData } from '../../../src/shared/types.js';
import { stringify } from '../../../src/utils/hash.js';
import { centerEllipsis, formatBalance, parseWalletError } from './utils.js';
import { useWallet } from './providers/WalletProvider/WalletProviderContext.js';
import { ConnectButton } from './providers/WalletProvider/ConnectButton.js';
import { ZeroHash } from './utils.js';

/** Default request expiration time */
const defaultExpire = '30s';

/** Default topic to publish requests the same as for the supplier node */
const defaultTopic = 'hello';

type RequestsRegistryRecord = Required<RequestRecord<RequestQuery, OfferOptions>>;

interface FormValues {
  topic: string;
  message: string;
}

interface RequestFormProps {
  connected: boolean;
  onSubmit(query: FormValues): void;
}

interface RequestsProps {
  requests: RequestsRegistryRecord[];
  subscribed?: (id: string) => boolean;
  onClear(): void;
  onCancel(id: string): void;
  onOffers(offers: OfferData<RequestQuery, OfferOptions>[]): void;
}

interface OffersProps {
  offers?: OfferData<RequestQuery, OfferOptions>[];
  onAccept(offers: OfferData<RequestQuery, OfferOptions>): void;
  onClose: () => void;
}

interface MakeDealProps {
  offer?: OfferData<RequestQuery, OfferOptions>;
  client?: Client<RequestQuery, OfferOptions>;
}

/**
 * Accepts user input
 */
export const RequestForm = ({ connected, onSubmit }: RequestFormProps) => {
  const [topic, setTopic] = useState<string>(defaultTopic);
  const [message, setMessage] = useState<string>('');

  if (!connected) {
    return null;
  }

  return (
    <div style={{ marginTop: 20 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (message === '') {
            return;
          }
          onSubmit({
            topic,
            message,
          });
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <div>
            <strong>Topic:</strong>
          </div>
          <div style={{ marginBottom: 5 }}>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div>
            <strong>Request:</strong>
          </div>
          <div>
            <input value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 10 }}>
            <div>
              <button type="submit">Send</button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

/**
 * Published requests table
 */
export const Requests = ({ requests, subscribed, onClear, onCancel, onOffers }: RequestsProps) => {
  if (requests.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: 20 }}>
      <h3>Requests</h3>
      <table border={1} cellPadding={5}>
        <thead>
          <tr>
            <td>Topic</td>
            <td>Id</td>
            <td>Query</td>
            <td>Subscribed</td>
            <td>Expired</td>
            <td>Offers</td>
            <td>Cancel</td>
          </tr>
        </thead>
        <tbody>
          {requests.map((r, index) => (
            <tr key={index}>
              <td>{r.data.topic}</td>
              <td>{centerEllipsis(r.data.id)}</td>
              <td>{JSON.stringify(r.data.query)}</td>
              <td>{subscribed && subscribed(r.data.id) ? '✅' : 'no'}</td>
              <td>{utils.isExpired(r.data.expire) || r.cancelled ? '✅' : 'no'}</td>
              <td>
                {r.offers.length === 0 ? 0 : ''}
                {r.offers.length > 0 && (
                  <button onClick={() => onOffers(r.offers)}>{r.offers.length}</button>
                )}
              </td>
              <td>
                {!r.cancelled && !utils.isExpired(r.data.expire) ? (
                  <button
                    onClick={() => {
                      onCancel(r.data.id);
                    }}
                  >
                    Cancel
                  </button>
                ) : (
                  'cancelled'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 10 }}>
        <button
          onClick={(e) => {
            e.preventDefault();
            onClear();
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
};

/**
 * Received offers table
 */
export const Offers = ({ offers, onAccept, onClose }: OffersProps) => {
  const [offerStates, setOfferStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (offers && offers.length > 0) {
      const expireHandler = () => {
        const newOfferStates: Record<string, boolean> = {};
        offers.forEach((offer) => {
          newOfferStates[offer.id] = utils.isExpired(offer.expire);
        });
        setOfferStates(newOfferStates);
      };

      const interval = setInterval(expireHandler, 1000);
      expireHandler();

      return () => clearInterval(interval);
    }
  }, [offers]);

  if (!offers || offers.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
        <div style={{ flex: 1 }}><h3>Offers</h3></div>
        <div style={{ flex: 1 }}><button onClick={onClose}>Close</button></div>
      </div>
      <table border={1} cellPadding={5}>
        <thead>
          <tr>
            <td>Id</td>
            <td>Data</td>
            <td>Expired</td>
            <td>Action</td>
          </tr>
        </thead>
        <tbody>
          {offers.map((o, index) => (
            <tr key={index}>
              <td>{centerEllipsis(o.id)}</td>
              <td>{stringify(o.options)}</td>
              <td>{offerStates[o.id] ? '✅' : 'no'}</td>
              <td>
                {!offerStates[o.id] ? <button onClick={() => onAccept(o)}>Accept</button> : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Making of deal form
 */
export const MakeDeal = ({ offer, client }: MakeDealProps) => {
  const { account, publicClient, walletClient } = useWallet();
  const [tx, setTx] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState<boolean>(false);

  const dealHandler = useCallback(
    async (paymentId: Hash) => {
      try {
        setTx(undefined);
        setError(undefined);
        setLoading(true);

        if (!client) {
          throw new Error('Client not ready');
        }

        if (!publicClient || !walletClient) {
          throw new Error('Ethereum client not ready');
        }

        if (!offer) {
          throw new Error('Invalid deal configuration');
        }

        await client.deals.create(offer, paymentId, ZeroHash, publicClient, walletClient, setTx);
        setLoading(false);
      } catch (err) {
        console.log(err);
        setError(parseWalletError(err));
        setLoading(false);
      }
    },
    [client, offer, publicClient, walletClient],
  );

  if (!offer) {
    return null;
  }

  if (!account) {
    return (
      <div style={{ marginTop: 20 }}>
        <h3>Make a deal on offer: {centerEllipsis(offer.id)}</h3>
        <div>Please connect your wallet to continue</div>
        <div>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 20 }}>
      <h3>Make a deal on offer: {centerEllipsis(offer.id)}</h3>
      <div>Offer options: {stringify(offer.options)}</div>
      <div>To make a deal choose a price option:</div>
      <div>
        <table border={1} cellPadding={5}>
          <thead>
            <tr>
              <td>Id</td>
              <td>Asset</td>
              <td>Price</td>
              <td>Action</td>
            </tr>
          </thead>
          <tbody>
            {offer.payment.map((p, index) => (
              <tr key={index}>
                <td>{centerEllipsis(p.id)}</td>
                <td>{p.asset}</td>
                <td>{formatBalance(p.price, 4)}</td>
                <td>
                  <button onClick={() => dealHandler(p.id)}>Deal</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tx && <div style={{ marginTop: 20 }}>Tx hash: {tx}</div>}
      {loading && <div style={{ marginTop: 20 }}>Loading...</div>}
      {error && (
        <div style={{ marginTop: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.1)' }}>
          {error}
        </div>
      )}
    </div>
  );
};

/**
 * Main application component
 */
export const App = () => {
  const client = useRef<Client<RequestQuery, OfferOptions> | undefined>();
  const { account, balance } = useWallet();
  const [connected, setConnected] = useState<boolean>(false);
  const [requests, setRequests] = useState<RequestsRegistryRecord[]>([]);
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
            session: true,
          }),
          dbKeysPrefix: 'wt_',
        };

        client.current = createClient<RequestQuery, OfferOptions>(options);

        client.current.addEventListener('start', () => {
          console.log('🚀 Client started at:', new Date().toISOString());
          if (client.current) {
            setRequests(client.current.requests.getAll());
          }
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

        const updateRequests = () => {
          if (!client.current) {
            return;
          }
          setRequests(client.current.requests.getAll());
        };

        /** Listening for requests events and update the table */
        client.current.addEventListener('request:create', updateRequests);
        client.current.addEventListener('request:subscribe', updateRequests);
        client.current.addEventListener('request:publish', updateRequests);
        client.current.addEventListener('request:unsubscribe', updateRequests);
        client.current.addEventListener('request:expire', updateRequests);
        client.current.addEventListener('request:cancel', updateRequests);
        client.current.addEventListener('request:delete', updateRequests);
        client.current.addEventListener('request:offer', updateRequests);
        client.current.addEventListener('request:clear', updateRequests);

        await client.current.start();
      } catch (error) {
        console.log(error);
        setError('Something went wrong...');
      }
    };

    startClient();
  }, []);

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
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <div>
            <div>{account ? account : ''}</div>
            <div>{account ? `${balance} ETH` : ''}</div>
          </div>
          <div style={{ marginLeft: '10px' }}>
            <ConnectButton />
          </div>
        </div>
      </div>
      {client.current && <div>✅ Client started</div>}
      {connected && <div>✅ Connected to the coordination server</div>}
      <RequestForm connected={connected} onSubmit={sendRequest} />
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
      <Offers offers={offers} onAccept={setOffer} onClose={() => setOffers(undefined)} />
      <MakeDeal offer={offer} client={client.current} />
      {error && <div style={{ marginTop: 20 }}>🚨 {error}</div>}
    </>
  );
};
