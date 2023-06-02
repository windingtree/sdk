import { useWallet } from './WalletProviderContext';
import { ConnectButton } from './ConnectButton';


export const AccountWidget = () => {
  const { account, balance } = useWallet();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginRight: 10 }}>
      {account &&
        <div style={{ marginBottom: 10 }}>
          <div>{account ? account : ''}</div>
          <div>{account ? `${balance} ETH` : ''}</div>
        </div>
      }
      <div>
        <ConnectButton />
      </div>
    </div>
  );
};
