import { createContext, useContext } from 'react';
import { Client } from '@windingtree/sdk-client';
import { GenericQuery, GenericOfferOptions } from '@windingtree/sdk-types';

export interface ClientContextData<
  RequestQuery extends GenericQuery = GenericQuery,
  OfferOptions extends GenericOfferOptions = GenericOfferOptions,
> {
  client: Client<RequestQuery, OfferOptions>;
  clientConnected: boolean;
}

export const ClientContext = createContext({} as ClientContextData);

export const useClient = <
  RequestQuery extends GenericQuery = GenericQuery,
  OfferOptions extends GenericOfferOptions = GenericOfferOptions,
>() => {
  const context =
    useContext<ClientContextData<RequestQuery, OfferOptions>>(ClientContext);

  if (context === undefined) {
    throw new Error('useClient must be used within a "ClientContext"');
  }

  return context;
};
