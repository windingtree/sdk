import { createContext, useContext } from 'react';
import { ClientDealsManager } from '@windingtree/sdk-client';
import { GenericQuery, GenericOfferOptions } from '@windingtree/sdk-types';

export interface DealsManagerProviderContextData<
  RequestQuery extends GenericQuery = GenericQuery,
  OfferOptions extends GenericOfferOptions = GenericOfferOptions,
> {
  dealsManager?: ClientDealsManager<RequestQuery, OfferOptions>;
}

export const DealsManagerContext = createContext({});

export const useDealsManager = <
  RequestQuery extends GenericQuery = GenericQuery,
  OfferOptions extends GenericOfferOptions = GenericOfferOptions,
>() => {
  const context =
    useContext<DealsManagerProviderContextData<RequestQuery, OfferOptions>>(
      DealsManagerContext,
    );

  if (context === undefined) {
    throw new Error(
      'useDealsManager must be used within a "DealsManagerContext"',
    );
  }

  return context;
};
