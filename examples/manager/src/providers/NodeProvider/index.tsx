import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { PropsWithChildren, useState, useEffect } from 'react';
import { NodeContext } from './NodeProviderContext';
import {
  ACCESS_TOKEN_NAME,
  accessTokenLink,
} from '../../../../../src/node/api/client.js';
import type { AppRouter } from '../../../../../src/node/api/index.js';
import { useConfig } from '../ConfigProvider/ConfigProviderContext.js';

export const NodeProvider = ({ children }: PropsWithChildren) => {
  const { nodeHost, setAuth, getAuthHeaders } = useConfig();
  const [node, setNode] = useState<
    ReturnType<typeof createTRPCProxyClient<AppRouter>> | undefined
  >();
  const [error, setError] = useState<string | undefined>();

  const stopClient = () => {
    try {
      setError(() => undefined);
      setNode(() => undefined);
    } catch (error) {
      setError((error as Error).message || 'Unknown node provider error');
    }
  };

  useEffect(() => {
    if (!nodeHost) {
      stopClient();
      return;
    }

    const startClient = async () => {
      try {
        setError(undefined);

        const tRpcNode = createTRPCProxyClient<AppRouter>({
          transformer: superjson,
          links: [
            accessTokenLink(ACCESS_TOKEN_NAME, setAuth),
            httpBatchLink({
              url: nodeHost,
              headers: getAuthHeaders,
            }),
          ],
        });

        const { message } = await tRpcNode.service.ping.query();

        if (message === 'pong') {
          setNode(() => tRpcNode);
        }
      } catch (error) {
        console.log(error);
        setNode(() => undefined);
        setError(
          () => (error as Error).message || 'Unknown node provider error',
        );
      }
    };

    startClient();

    return () => {
      stopClient();
    };
  }, [getAuthHeaders, setAuth, nodeHost]);

  return (
    <NodeContext.Provider
      value={{
        node,
        nodeConnected: Boolean(node),
        nodeError: error,
      }}
    >
      {children}
    </NodeContext.Provider>
  );
};
