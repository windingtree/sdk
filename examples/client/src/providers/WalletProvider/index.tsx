import { useState, PropsWithChildren, useEffect } from 'react';
import {
  Address,
  PublicClient,
  WalletClient,
  custom,
  createPublicClient,
  createWalletClient,
  http,
} from 'viem';
import { polygonZkEvmTestnet, hardhat } from 'viem/chains';
import { WalletContext } from './WalletProviderContext';
import { formatBalance } from '../../utils';

export const WalletProvider = ({ children }: PropsWithChildren) => {
  const [publicClient, setPublicClient] = useState<PublicClient | undefined>();
  const [walletClient, setWalletClient] = useState<WalletClient | undefined>();
  const [chainId, setChainId] = useState<bigint | undefined>();
  const [account, setAccount] = useState<Address | undefined>();
  const [loading, setLoading] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [balance, setBalance] = useState<string>('0.0000');
  const [error, setError] = useState<string | undefined>();

  const getChainId = async (publicClient: PublicClient): Promise<bigint> =>
    BigInt(await publicClient.getChainId());

  const getBalance = async (publicClient: PublicClient, address: Address): Promise<bigint> =>
    await publicClient.getBalance({ address });

  const handleAccountsChanged = async (): Promise<void> => {
    setLoading(true);
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });
    setAccount(accounts[0]);
    setLoading(false);
  };

  const handleChainChanged = async (): Promise<void> => {
    const publicClient = createPublicClient({
      chain: import.meta.env.VITE_LOCAL_NODE === 'hardhat' ? hardhat : polygonZkEvmTestnet,
      transport: http(),
    });
    setPublicClient(publicClient);
    const walletClient = createWalletClient({
      chain: import.meta.env.VITE_LOCAL_NODE === 'hardhat' ? hardhat : polygonZkEvmTestnet,
      transport: custom(window.ethereum),
    });
    setWalletClient(walletClient);
    setLoading(true);
    const chainId = await getChainId(publicClient);
    setChainId(chainId);
    setIsConnected(window.ethereum.isConnected());
    setLoading(false);
  };

  const connect = async () => {
    try {
      if (!window.ethereum) {
        throw new Error('Injected provider not found');
      }

      await handleAccountsChanged();
      await handleChainChanged();

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    } catch (err) {
      setError((err as Error).message || 'Unknown wallet connection error');
    }
  };

  const disconnect = async () => {
    try {
      if (!window.ethereum) {
        throw new Error('Injected provider not found');
      }

      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
      setIsConnected(false);
      setAccount(undefined);
      setPublicClient(undefined);
      setWalletClient(undefined);
      setChainId(undefined);
    } catch (err) {
      setError((err as Error).message || 'Unknown wallet disconnection error');
    }
  };

  useEffect(() => {
    if (account && publicClient) {
      const balanceHandler = () =>
        getBalance(publicClient, account)
          .then((accountBalance) => {
            setBalance(formatBalance(accountBalance, 4));
          })
          .catch((err) => {
            setError((err as Error).message || 'Unknown wallet balance error');
          });
      const interval = setInterval(balanceHandler, 1000);

      return () => clearInterval(interval);
    }
  }, [account, publicClient]);

  return (
    <WalletContext.Provider
      value={{
        publicClient,
        walletClient,
        chainId,
        account,
        loading,
        isConnected,
        balance,
        connect,
        disconnect,
        error,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
