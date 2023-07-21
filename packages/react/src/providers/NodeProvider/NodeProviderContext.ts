import { createContext, useContext } from 'react';
import { createTRPCProxyClient } from '@trpc/client';
import type { AppRouter } from '@windingtree/sdk-node-api/router';

export interface NodeContextData {
  node?: ReturnType<typeof createTRPCProxyClient<AppRouter>> | undefined;
  nodeConnected: boolean;
  nodeError?: string;
}

export const NodeContext = createContext<NodeContextData>(
  {} as NodeContextData,
);

export const useNode = () => {
  const context = useContext(NodeContext);

  if (context === undefined) {
    throw new Error('useNode must be used within a "NodeContext"');
  }

  return context;
};
