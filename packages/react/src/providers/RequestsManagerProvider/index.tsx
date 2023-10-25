import { PropsWithChildren, useEffect, useState } from 'react';
import { GenericQuery, GenericOfferOptions } from '@windingtree/sdk-types';
import { Storage, StorageInitializer } from '@windingtree/sdk-storage';
import { ClientRequestsManager } from '@windingtree/sdk-client';
import { RequestsManagerContext } from './RequestsManagerProviderContext.js';

export interface RequestsManagerProvideProps<
  CustomStorage extends Storage = Storage,
> extends PropsWithChildren {
  storageInitializer: StorageInitializer<CustomStorage>;
  prefix: string;
}

export const RequestsManagerProvider = <
  RequestQuery extends GenericQuery = GenericQuery,
  OfferOptions extends GenericOfferOptions = GenericOfferOptions,
  CustomStorage extends Storage = Storage,
>({
  children,
  storageInitializer,
  prefix,
}: RequestsManagerProvideProps<CustomStorage>) => {
  const [requestsManager, setRequestsManager] = useState<
    ClientRequestsManager<RequestQuery, OfferOptions> | undefined
  >();

  useEffect(() => {
    const startManager = async () => {
      const storage = await storageInitializer();

      setRequestsManager(
        () =>
          new ClientRequestsManager<RequestQuery, OfferOptions>({
            storage,
            prefix,
          }),
      );
    };

    startManager().catch(console.error);
  }, [storageInitializer, prefix]);

  return (
    <RequestsManagerContext.Provider
      value={{
        requestsManager,
      }}
    >
      {children}
    </RequestsManagerContext.Provider>
  );
};
