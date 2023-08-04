import { PropsWithChildren, useMemo } from 'react';
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

  return (
    <ClientContext.Provider
      value={{
        client,
        clientConnected: Boolean(client.connected),
      }}
    >
      {children}
    </ClientContext.Provider>
  );
};
