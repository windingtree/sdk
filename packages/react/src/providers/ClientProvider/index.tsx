import { PropsWithChildren, useMemo, useState, useEffect } from 'react';
import { GenericQuery, GenericOfferOptions } from '@windingtree/sdk-types';
import { createClient } from '@windingtree/sdk-client';
import { ClientContext } from './ClientProviderContext.js';

export interface ClientProvideProps extends PropsWithChildren {
  serverAddress: string;
}

export const ClientProvider = <
  RequestQuery extends GenericQuery = GenericQuery,
  OfferOptions extends GenericOfferOptions = GenericOfferOptions,
>({
  children,
  serverAddress,
}: ClientProvideProps) => {
  const client = useMemo(
    () =>
      createClient<RequestQuery, OfferOptions>({
        serverAddress,
      }),
    [serverAddress],
  );
  const [clientConnected, setClientConnected] = useState<boolean>(false);

  useEffect(() => {
    const onClientConnected = () => setClientConnected(true);
    const onClientDisconnected = () => setClientConnected(false);
    client.addEventListener('connected', onClientConnected);
    client.addEventListener('disconnected', onClientDisconnected);

    return () => {
      client.removeEventListener('connected', onClientConnected);
      client.removeEventListener('disconnected', onClientDisconnected);
    };
  }, [client]);

  return (
    <ClientContext.Provider
      value={{
        client,
        clientConnected,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
};
