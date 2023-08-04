import { PropsWithChildren, useEffect, useState } from 'react';
import { Chain } from 'viem/chains';
import {
  GenericQuery,
  GenericOfferOptions,
  Contracts,
} from '@windingtree/sdk-types';
import { Storage, StorageInitializer } from '@windingtree/sdk-storage';
import { ClientDealsManager } from '@windingtree/sdk-client';
import { useWallet } from '../WalletProvider/WalletProviderContext.js';
import { DealsManagerContext } from './DealsManagerProviderContext.js';

export interface DealsManagerProvideProps<
  CustomStorage extends Storage = Storage,
> extends PropsWithChildren {
  storageInitializer: StorageInitializer<CustomStorage>;
  prefix: string;
  checkInterval: string | number;
  chain: Chain;
  contracts: Contracts;
}

export const DealsManagerProvider = <
  RequestQuery extends GenericQuery = GenericQuery,
  OfferOptions extends GenericOfferOptions = GenericOfferOptions,
  CustomStorage extends Storage = Storage,
>({
  children,
  storageInitializer,
  prefix,
  checkInterval,
  chain,
  contracts,
}: DealsManagerProvideProps<CustomStorage>) => {
  const { publicClient } = useWallet();
  const [dealsManager, setDealsManager] = useState<
    ClientDealsManager<RequestQuery, OfferOptions> | undefined
  >();

  useEffect(() => {
    const startManager = async () => {
      const storage = await storageInitializer();

      setDealsManager(
        () =>
          new ClientDealsManager<RequestQuery, OfferOptions>({
            storage,
            prefix,
            checkInterval,
            chain,
            contracts,
            publicClient,
          }),
      );
    };

    startManager().catch(console.error);
  }, [
    storageInitializer,
    prefix,
    checkInterval,
    chain,
    contracts,
    publicClient,
  ]);

  return (
    <DealsManagerContext.Provider
      value={{
        dealsManager,
      }}
    >
      {children}
    </DealsManagerContext.Provider>
  );
};
