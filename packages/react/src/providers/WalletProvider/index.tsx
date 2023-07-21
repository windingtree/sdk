import {
  useState,
  PropsWithChildren,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  Address,
  PublicClient,
  WalletClient,
  custom,
  createPublicClient,
  createWalletClient,
  http,
} from 'viem';
import { Chain } from 'viem/chains';
import { WalletContext } from './WalletProviderContext.js';
import { formatBalance } from '../../utils/index.js';

export interface WalletProviderProps extends PropsWithChildren {
  targetChain: Chain;
}

export const WalletProvider = ({ targetChain, children }: WalletProviderProps) => {
  const [walletClient, setWalletClient] = useState<WalletClient | undefined>();
  const [chainId, setChainId] = useState<bigint | undefined>();
  const [account, setAccount] = useState<Address | undefined>();
  const [loading, setLoading] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [balance, setBalance] = useState<string>('0.0000');
  const [error, setError] = useState<string | undefined>();

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: targetChain,
        transport: http(),
      }),
    [targetChain],
  );

  const getChainId = useCallback(
    async (publicClient: PublicClient): Promise<bigint> =>
      BigInt(await publicClient.getChainId()),
    [],
  );

  const getBalance = useCallback(
    async (publicClient: PublicClient, address: Address): Promise<bigint> =>
      await publicClient.getBalance({ address }),
    [],
  );

  const handleAccountsChanged = useCallback(async (): Promise<void> => {
    setLoading(true);
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });
    setAccount(accounts[0]);
    setLoading(false);
  }, []);

  const handleChainChanged = useCallback(async (): Promise<void> => {
    const walletClient = createWalletClient({
      chain: targetChain,
      transport: custom(window.ethereum),
    });
    setWalletClient(walletClient);
    setLoading(true);
    const chainId = await getChainId(publicClient);
    setChainId(chainId);
    setIsConnected(window.ethereum.isConnected());
    setLoading(false);
  }, [getChainId, publicClient, targetChain]);

  const connect = useCallback(async () => {
    try {
      if (!window.ethereum) {
        throw new Error('Injected provider not found');
      }

      await handleAccountsChanged();
      await handleChainChanged();

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      window.localStorage.setItem('walletConnected', 'yes');
    } catch (err) {
      setError((err as Error).message || 'Unknown wallet connection error');
    }
  }, [handleAccountsChanged, handleChainChanged]);

  const disconnect = useCallback(() => {
    try {
      if (!window.ethereum) {
        throw new Error('Injected provider not found');
      }

      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
      setIsConnected(false);
      setAccount(undefined);
      setWalletClient(undefined);
      setChainId(undefined);
      window.localStorage.setItem('walletConnected', 'no');
    } catch (err) {
      setError((err as Error).message || 'Unknown wallet disconnection error');
    }
  }, [handleAccountsChanged, handleChainChanged]);

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
    } else if (window.localStorage.getItem('walletConnected') === 'yes') {
      connect().catch(console.error);
    }
  }, [account, publicClient, connect, getBalance]);

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
        targetChain,
        error,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
