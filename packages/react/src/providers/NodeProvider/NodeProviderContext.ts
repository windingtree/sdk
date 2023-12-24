import { createContext, useContext, Context } from 'react';
import type { AnyRouter } from '@trpc/server';
import { createTRPCProxyClient } from '@trpc/client';
import type { AppRouter } from '@windingtree/sdk-node-api/router';

export interface NodeContextData<TRouter extends AnyRouter = AppRouter> {
  node?: ReturnType<typeof createTRPCProxyClient<TRouter>> | undefined;
  nodeConnected: boolean;
  nodeError?: string;
}

export const NodeContext = createContext<NodeContextData>(
  {} as NodeContextData,
);

export const useNode = <TRouter extends AnyRouter = AppRouter>() => {
  const context = useContext<NodeContextData<TRouter>>(
    NodeContext as Context<NodeContextData<TRouter>>,
  );

  if (context === undefined) {
    throw new Error('useNode must be used within a "NodeContext"');
  }

  return context;
};
