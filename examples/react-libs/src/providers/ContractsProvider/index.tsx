import { PropsWithChildren, useEffect, useState } from 'react';
import { ContractsContext } from './ContractsProviderContext';
import { useWallet } from '../WalletProvider/WalletProviderContext';
import { ProtocolContracts } from '../../../../../src/shared/contracts';
import { contractsConfig } from '../../../../shared/index.js'

export const ContractProvider = ({ children }: PropsWithChildren) => {
  const { publicClient, walletClient } = useWallet();
  const [contracts, setContracts] = useState<ProtocolContracts | undefined>();

  useEffect(() => {
    setContracts(
      new ProtocolContracts({
        contracts: contractsConfig,
        publicClient,
        walletClient,
      })
    );

    return () => setContracts(undefined);
  }, [publicClient, walletClient]);

  return (
    <ContractsContext.Provider
      value={{
        contracts
      }}
    >
      {children}
    </ContractsContext.Provider>
  );
};
