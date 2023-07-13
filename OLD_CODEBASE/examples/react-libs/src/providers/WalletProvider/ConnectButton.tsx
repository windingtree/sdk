import { useWallet } from './WalletProviderContext';

/**
 * This button allows to connect/disconnect injected wallet
 */
export const ConnectButton = () => {
  const { loading, isConnected, connect, disconnect } = useWallet();

  if (!isConnected) {
    return <button onClick={connect}>Connect{loading ? '...' : ''}</button>;
  }

  return <button onClick={disconnect}>Disconnect</button>;
};
