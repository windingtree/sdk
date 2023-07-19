import { createContext, useContext } from 'react';
import { ProtocolContracts } from '@windingtree/sdk-contracts-manager';

export interface ContractsContextData {
  contracts?: ProtocolContracts;
}

export const ContractsContext = createContext<ContractsContextData>(
  {} as ContractsContextData,
);

export const useContracts = () => {
  const context = useContext(ContractsContext);

  if (context === undefined) {
    throw new Error('useContracts must be used within a "ContractsContext"');
  }

  return context;
};
