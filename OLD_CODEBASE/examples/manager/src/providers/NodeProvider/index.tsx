import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { PropsWithChildren, useState, useEffect } from 'react';
import { NodeContext } from './NodeProviderContext';
import { unauthorizedLink } from '../../../../../src/node/api/client.js';
import type { AppRouter } from '../../../../../src/node/api/index.js';
import { useConfig } from '../ConfigProvider/ConfigProviderContext.js';

export const NodeProvider = ({ children }: PropsWithChildren) => {
  const { nodeHost, setAuth, resetAuth } = useConfig();
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
            unauthorizedLink(resetAuth),
            httpBatchLink({
              url: nodeHost,
              fetch(url, options) {
                return fetch(url, {
                  ...options,
                  // allows to send cookies to the server
                  credentials: 'include',
                });
              },
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
        let errMessage = (error as Error).message;

        if (errMessage === 'Failed to fetch') {
          errMessage = 'Node connection failed';
        }

        setError(
          () => errMessage || 'Unknown node provider error',
        );
      }
    };

    startClient();

    return () => {
      stopClient();
    };
  }, [nodeHost, setAuth, resetAuth]);

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
