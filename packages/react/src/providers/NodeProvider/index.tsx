import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import {
  type PropsWithChildren,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { NodeContext } from './NodeProviderContext.js';
import { AppRouter } from '@windingtree/sdk-node-api/router';
import { unauthorizedLink } from '@windingtree/sdk-node-api/client';
import { useConfig } from '../ConfigProvider/ConfigProviderContext.js';
import { usePoller } from '../../hooks/usePoller.js';
import { createLogger } from '@windingtree/sdk-logger';

// Initialize logger
const logger = createLogger('NodeProvider');

export const NodeProvider = ({ children }: PropsWithChildren) => {
  const { nodeHost, resetAuth } = useConfig();
  const [node, setNode] = useState<
    ReturnType<typeof createTRPCProxyClient<AppRouter>> | undefined
  >();
  const [error, setError] = useState<string | undefined>();
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Function to stop and reset the client
  const stopClient = useCallback(() => {
    setError(undefined);
    setNode(undefined);
  }, []);

  // Function to check the connection
  const checkConnection = useCallback(async () => {
    setError(undefined);

    if (!node) {
      setIsConnected(false);
      return;
    }

    try {
      const { message } = await node.service.ping.query();
      setIsConnected(message === 'pong');
    } catch (err) {
      setIsConnected(false);
      setError('Unable to connect the Node');
      logger.error(err);
    }
  }, [node]);

  // Initialize and clean up the client
  useEffect(() => {
    const startClient = async () => {
      if (!nodeHost) {
        return;
      }

      try {
        const tRpcNode = createTRPCProxyClient<AppRouter>({
          transformer: superjson,
          links: [
            unauthorizedLink(resetAuth),
            httpBatchLink({
              url: nodeHost,
              fetch(url, options) {
                return fetch(url, {
                  ...options,
                  credentials: 'include',
                });
              },
            }),
          ],
        });

        setNode(() => tRpcNode);
      } catch (err) {
        setError((err as Error).message || 'Unknown node provider error');
        logger.error(err);
      }
    };

    startClient();

    return () => {
      stopClient();
    };
  }, [stopClient, resetAuth, nodeHost]);

  // Polling for connection check
  usePoller(checkConnection, 5000, true, 'NodeConnection');

  return (
    <NodeContext.Provider
      value={{
        node,
        nodeConnected: isConnected,
        nodeError: error,
      }}
    >
      {children}
    </NodeContext.Provider>
  );
};
