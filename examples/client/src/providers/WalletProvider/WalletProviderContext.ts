import { createContext, useContext } from 'react';
import { Address, Chain, PublicClient, WalletClient } from 'viem';

export interface WalletContextData {
  publicClient: PublicClient;
  walletClient?: WalletClient;
  chainId?: bigint;
  account?: Address;
  loading: boolean;
  isConnected: boolean;
  balance: string;
  targetChain: Chain;
  error?: string;
  connect(): void;
  disconnect(): void;
}

export const WalletContext = createContext<WalletContextData>({} as WalletContextData);

export const useWallet = () => {
  const context = useContext(WalletContext);

  if (context === undefined) {
    throw new Error('useWallet must be used within a "WalletContext"');
  }

  return context;
};
