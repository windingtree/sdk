import {
  RequestQuerySchema,
  RequestQuery,
  OfferOptionsSchema,
  OfferOptions,
  contractConfig,
  serverAddress,
} from '../../common/types.js';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient, Client, ClientOptions, Request } from '../../../src/index.js';
import { localStorage } from '../../../src/storage/index.js';
import { isExpired } from '../../../src/utils/time.js';

const defaultExpire = '15s'; // 5 sec

const defaultTopic = 'hello';

const options: ClientOptions<RequestQuery, OfferOptions> = {
  querySchema: RequestQuerySchema,
  offerOptionsSchema: OfferOptionsSchema,
  contractConfig,
  serverAddress,
};

interface FormValues {
  topic: string;
  message: string;
}

interface RequestFormProps {
  connected: boolean;
  subscribed: boolean;
  onSubmit(query: FormValues): void;
  onCancel(): void;
}

interface RequestsProps {
  requests: Required<Request<RequestQuery, OfferOptions>>[];
  onClear(): void;
}

export const RequestForm = ({ connected, subscribed, onSubmit, onCancel }: RequestFormProps) => {
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
            <input value={topic} onChange={(e) => setTopic(e.target.value)} disabled={subscribed} />
          </div>
          <div>
            <strong>Request:</strong>
          </div>
          <div>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={subscribed}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 10 }}>
            <div>
              <button type="submit" disabled={subscribed}>
                Send{subscribed ? '...' : ''}
              </button>
            </div>
            <div style={{ marginLeft: 10 }}>
              {subscribed && (
                <button
                  onClick={() => {
                    onCancel();
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export const Requests = ({ requests, onClear }: RequestsProps) => {
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
            <td>Published</td>
            <td>Expired</td>
            <td>Offers</td>
          </tr>
        </thead>
        <tbody>
          {requests.map((r, index) => (
            <tr key={index}>
              <td>{r.topic}</td>
              <td>{r.data.id}</td>
              <td>{JSON.stringify(r.data.query)}</td>
              <td>{r.published}</td>
              <td>{isExpired(r.data.expire) ? '✅' : 'no'}</td>
              <td>{r.offers.size}</td>
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
  const query = useRef<Request<RequestQuery, OfferOptions> | undefined>();
  const [connected, setConnected] = useState<boolean>(false);
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [requests, setRequests] = useState<Required<Request<RequestQuery, OfferOptions>>[]>([]);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const startClient = async () => {
      try {
        setError(undefined);
        client.current = createClient<RequestQuery, OfferOptions>(
          options,
          localStorage.init({
            session: true,
          }),
        );

        client.current.addEventListener('start', () => {
          console.log('🚀 Client started at:', new Date().toISOString());
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

        client.current.addEventListener('requests', ({ detail }) => {
          setRequests(detail);
        });

        await client.current.start();
      } catch (error) {
        console.log(error);
        setError('Something went wrong...');
      }
    };

    startClient();
  }, []);

  const sendRequest = async ({ topic, message }: FormValues) => {
    try {
      setError(undefined);

      if (!client.current) {
        throw new Error('The client is not initialized yet');
      }

      if (query.current && query.current.subscribed) {
        query.current.cancel();
      }

      query.current = await client.current.buildRequest(topic, defaultExpire, 1, {
        greeting: message,
      });

      query.current.addEventListener('expired', () => {
        setSubscribed(false);
      });

      await query.current.publish();
      setSubscribed(true);
    } catch (error) {
      setError((error as Error).message);
      setSubscribed(false);
    }
  };

  const cancelRequest = useCallback(() => {
    if (query.current) {
      query.current.cancel();
      setSubscribed(false);
    }
  }, [query]);

  return (
    <>
      {client.current && <div>✅ Client started</div>}
      {connected && <div>✅ Connected to the coordination server</div>}
      {subscribed && (
        <>
          <div>✅ Sent request: {query.current?.toJSON()}</div>
          <div>✅ Subscribed to: {query.current?.data?.id}</div>
        </>
      )}
      <RequestForm
        connected={connected}
        subscribed={subscribed}
        onSubmit={sendRequest}
        onCancel={cancelRequest}
      />
      <Requests
        requests={requests}
        onClear={() => {
          cancelRequest();
          client.current?.requests.clear();
        }}
      />
      {error && <div style={{ marginTop: 20 }}>🚨 {error}</div>}
    </>
  );
};
