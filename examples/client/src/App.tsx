import {
  RequestQuerySchema,
  RequestQuery,
  OfferOptionsSchema,
  OfferOptions,
  contractConfig,
  serverAddress,
} from '../../shared/types.js';
import { useState, useEffect, useRef } from 'react';
import { createClient, Client, ClientOptions } from '../../../src/index.js';
import { localStorage } from '../../../src/storage/index.js';
import { isExpired } from '../../../src/utils/time.js';
import { RequestRecord } from '../../../src/client/requestManager.js';

/** Default request expiration time */
const defaultExpire = '30s';

/** Default topic to publish requests the same as for the supplier node */
const defaultTopic = 'hello';

interface FormValues {
  topic: string;
  message: string;
}

interface RequestFormProps {
  connected: boolean;
  onSubmit(query: FormValues): void;
}

interface RequestsProps {
  requests: Required<RequestRecord<RequestQuery, OfferOptions>>[];
  subscribed?: (id: string) => boolean;
  onClear(): void;
  onCancel(id: string): void;
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
export const Requests = ({ requests, subscribed, onClear, onCancel }: RequestsProps) => {
  if (requests.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: 20 }}>
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
              <td>{r.data.id}</td>
              <td>{JSON.stringify(r.data.query)}</td>
              <td>{subscribed && subscribed(r.data.id) ? '✅' : 'no'}</td>
              <td>{isExpired(r.data.expire) || r.cancelled ? '✅' : 'no'}</td>
              <td>{r.offers.length}</td>
              <td>
                {!r.cancelled && !isExpired(r.data.expire) ? (
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

export const App = () => {
  const client = useRef<Client<RequestQuery, OfferOptions> | undefined>();
  const [connected, setConnected] = useState<boolean>(false);
  const [requests, setRequests] = useState<Required<RequestRecord<RequestQuery, OfferOptions>>[]>(
    [],
  );
  const [error, setError] = useState<string | undefined>();

  /** This hook starts the client that will be available via `client.current` */
  useEffect(() => {
    const startClient = async () => {
      try {
        setError(undefined);

        const options: ClientOptions<RequestQuery, OfferOptions> = {
          querySchema: RequestQuerySchema,
          offerOptionsSchema: OfferOptionsSchema,
          contractConfig,
          serverAddress,
          storageInitializer: localStorage.createInitializer({
            session: true,
          }),
          requestRegistryPrefix: 'requestsRegistry',
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
        nonce: 1,
        query: {
          greeting: message,
        },
      });

      client.current.requests.publish(request);
    } catch (error) {
      setError((error as Error).message);
    }
  };

  return (
    <>
      {client.current && <div>✅ Client started</div>}
      {connected && <div>✅ Connected to the coordination server</div>}
      <RequestForm connected={connected} onSubmit={sendRequest} />
      <Requests
        requests={requests}
        subscribed={(id) => {
          console.log('###', id);
          return client.current?.requests.subscribed(id) || false;
        }}
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
      />
      {error && <div style={{ marginTop: 20 }}>🚨 {error}</div>}
    </>
  );
};
