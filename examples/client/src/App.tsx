import { useState, useEffect } from 'react';
import { createClient, Client, ClientOptions } from '../../../src/index.js';

const options: ClientOptions = {
  serverAddress: '/ip4/127.0.0.1/tcp/33333/ws/p2p/QmcXbDrzUU5ERqRaronWmAJXwe6c7AEkS7qdcsjgEuWPCf',
};

interface RequestFormProps {
  onSubmit(value: string): void;
}

export const RequestForm = ({ onSubmit }: RequestFormProps) => {
  const [value, setValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  return (
    <div style={{ marginTop: 20 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value === '') {
            return;
          }
          setLoading(true);
          onSubmit(value);
        }}
      >
        <div>Request:</div>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={loading}
          style={{ marginBottom: 10 }}
        />
        <br />
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div>
            <button type="submit" disabled={loading}>
              Send{loading ? '...' : ''}
            </button>
          </div>
          <div style={{ marginLeft: 10 }}>{loading && <button onClick={() => setLoading(false)}>Cancel</button>}</div>
        </div>
      </form>
    </div>
  );
};

export const App = () => {
  const [error, setError] = useState<string | undefined>();
  const [client, setClient] = useState<Client | undefined>();
  const [connected, setConnected] = useState<boolean>(false);

  useEffect(() => {
    const startClient = async () => {
      try {
        setError(undefined);
        const client = createClient(options);

        client.addEventListener('start', () => {
          console.log('🚀 Client started at:', new Date().toISOString());
        });

        client.addEventListener('stop', () => {
          console.log('👋 Client stopped at:', new Date().toISOString());
        });

        client.addEventListener('connected', () => {
          setConnected(true);
          console.log('🔗 Client connected to server at:', new Date().toISOString());
        });

        client.addEventListener('disconnected', () => {
          setConnected(false);
          console.log('🔌 Client disconnected from server at:', new Date().toISOString());
        });

        await client.start();
        setClient(client);
      } catch (error) {
        console.log(error);
        setError('Something went wrong...');
      }
    };

    startClient();
  }, []);

  return (
    <>
      {client !== undefined && <div>✅ Client started</div>}
      {connected && (
        <div>
          <div>✅ Connected to the coordination server</div>
          <RequestForm
            onSubmit={(request) => {
              console.log('@@@', request);
            }}
          />
        </div>
      )}
      {error && <div>🚨 {error}</div>}
    </>
  );
};
