import { createContext, useContext } from 'react';
import { Client } from '@windingtree/sdk-client';

export interface ClientContextData {
  client: Client;
  clientConnected: boolean;
}

export const ClientContext = createContext<ClientContextData>(
  {} as ClientContextData,
);

export const useClient = () => {
  const context = useContext(ClientContext);

  if (context === undefined) {
    throw new Error('useClient must be used within a "ClientContext"');
  }

  return context;
};
