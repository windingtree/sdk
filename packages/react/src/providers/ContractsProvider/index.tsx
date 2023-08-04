import { PropsWithChildren, useEffect, useState } from 'react';
import { ContractsContext } from './ContractsProviderContext.js';
import { useWallet } from '../WalletProvider/WalletProviderContext.js';
import { ProtocolContracts } from '@windingtree/sdk-contracts-manager';
import { Contracts } from '@windingtree/sdk-types';

export interface ContractProviderProps extends PropsWithChildren {
  contractsConfig: Contracts;
}

export const ContractsProvider = ({
  contractsConfig,
  children,
}: ContractProviderProps) => {
  const { publicClient, walletClient } = useWallet();
  const [contracts, setContracts] = useState<ProtocolContracts | undefined>();

  useEffect(() => {
    setContracts(
      new ProtocolContracts({
        contracts: contractsConfig,
        publicClient,
        walletClient,
      }),
    );

    return () => setContracts(undefined);
  }, [contractsConfig, publicClient, walletClient]);

  return (
    <ContractsContext.Provider
      value={{
        contracts,
      }}
    >
      {children}
    </ContractsContext.Provider>
  );
};
