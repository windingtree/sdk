import { createContext, useContext } from 'react';
import { Address, PublicClient, WalletClient } from 'viem';

export interface WalletContextData {
  publicClient: PublicClient;
  walletClient?: WalletClient;
  chainId?: bigint;
  account?: Address;
  loading: boolean;
  isConnected: boolean;
  balance: string;
  connect(): void;
  disconnect(): void;
  error?: string;
}

export const WalletContext = createContext<WalletContextData>({} as WalletContextData);

export const useWallet = () => {
  const context = useContext(WalletContext);

  if (context === undefined) {
    throw new Error('useWallet must be used within a "WalletContext"');
  }

  return context;
};
