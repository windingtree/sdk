import { createContext, useContext } from 'react';
import { ClientRequestsManager } from '@windingtree/sdk-client';
import { GenericQuery, GenericOfferOptions } from '@windingtree/sdk-types';

export interface RequestsManagerProviderContextData<
  RequestQuery extends GenericQuery = GenericQuery,
  OfferOptions extends GenericOfferOptions = GenericOfferOptions,
> {
  requestsManager?: ClientRequestsManager<RequestQuery, OfferOptions>;
}

export const RequestsManagerContext = createContext({});

export const useRequestsManager = <
  RequestQuery extends GenericQuery = GenericQuery,
  OfferOptions extends GenericOfferOptions = GenericOfferOptions,
>() => {
  const context = useContext<
    RequestsManagerProviderContextData<RequestQuery, OfferOptions>
  >(RequestsManagerContext);

  if (context === undefined) {
    throw new Error(
      'useRequestsManager must be used within a "RequestsManagerContext"',
    );
  }

  return context;
};
