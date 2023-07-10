import { useState, useCallback, useEffect } from 'react';
import { Address, Hash } from 'viem';
import {
  generateMnemonic,
  deriveAccount,
  supplierId as createSupplierId,
  getPk,
} from '../../../../src/utils';
import { randomSalt } from '@windingtree/contracts';
import {
  ConfigActions,
  useConfig,
} from '../providers/ConfigProvider/ConfigProviderContext';
import { useWallet } from '../../../react-libs/src/providers/WalletProvider/WalletProviderContext';
import type { CustomConfig } from '../main';
import { TabPanel, Tabs } from './Tabs';
import { ConnectButton } from '../../../react-libs/src/providers/WalletProvider/ConnectButton';
import { copyToClipboard } from '../../../react-libs/src/utils';

export const Supplier = () => {
  const { account } = useWallet();
  const { supplierId, setConfig } = useConfig<CustomConfig>();
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const [ownerMnemonic, setOwnerMnemonic] = useState<string | undefined>();
  const [signerMnemonic, setSignerMnemonic] = useState<string | undefined>();
  const [ownerAccount, setOwnerAccount] = useState<Address | undefined>();
  const [ownerPk, setOwnerPk] = useState<string | undefined>();
  const [signerAccount, setSignerAccount] = useState<Address | undefined>();
  const [salt, setSalt] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const generateWallet = useCallback((target: 'owner' | 'signer') => {
    try {
      let stateHandler;

      switch (target) {
        case 'owner':
          stateHandler = setOwnerMnemonic;
          break;
        case 'signer':
          stateHandler = setSignerMnemonic;
          break;
        default:
          throw new Error('Unknown wallet target');
      }

      stateHandler(() => generateMnemonic());
    } catch (error) {
      console.log(error);
      setError((error as Error).message || 'Unknown setup error');
    }
  }, []);

  useEffect(() => {
    if (!ownerMnemonic) {
      setOwnerAccount(() => undefined);
      setOwnerPk(() => undefined);
    } else {
      const acc = deriveAccount(ownerMnemonic, 0);
      setOwnerAccount(() => acc.address);
      setOwnerPk(() => getPk(acc));
    }
  }, [ownerMnemonic]);

  useEffect(() => {
    if (!signerMnemonic) {
      setSignerAccount(() => undefined);
    } else {
      setSignerAccount(() => deriveAccount(signerMnemonic, 0).address);
    }
  }, [signerMnemonic]);

  useEffect(() => {
    if (!ownerAccount || !salt) {
      setConfig({
        type: ConfigActions.SET_CONFIG,
        payload: {
          supplierId: undefined,
        },
      });
    } else {
      const id = createSupplierId(salt as Hash, ownerAccount);
      setConfig({
        type: ConfigActions.SET_CONFIG,
        payload: {
          supplierId: id,
        },
      });
    }
  }, [setConfig, ownerAccount, salt]);

  return (
    <>
      <Tabs
        tabs={[
          {
            id: 0,
            title: 'Register',
            active: true,
          },
          {
            id: 1,
            title: 'View',
          },
          {
            id: 2,
            title: 'Manage',
          },
        ]}
        onChange={setSelectedTab}
      />
      <TabPanel id={0} activeTab={selectedTab}>
        <form onSubmit={(e) => e.preventDefault()}>
          <div
            style={{
              padding: 5,
              backgroundColor: 'rgba(0,0,0,0.05)',
              color: 'red',
            }}
          >
            <ul>
              <li>
                Generated mnemonics will not be persisted for security reasons.
              </li>
              <li>
                If you will refresh the application page you will loss generated
                mnemonics.
              </li>
              <li>This UI is dedicated for the SDK testing only.</li>
              <li>
                It is not recommended to use this UI for the `production` setup of
                the entity.
              </li>
            </ul>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <h3>Supplier entity owner wallet</h3>
              <div style={{ padding: 2, backgroundColor: 'rgba(0,0,0,0.1)' }}>
                <p>
                  This account owns the entity and its funds and can change the
                  configuration of the object in the smart contract.
                </p>
              </div>
              <div>
                <button onClick={() => generateWallet('owner')}>
                  {ownerMnemonic ? 'Re-' : ''}Generate owner account mnemonic
                </button>
              </div>
              <div>
                <input
                  style={{ width: '100%' }}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Press `Generate` button above or paste an externally generated mnemonic here"
                  value={ownerMnemonic || ''}
                  onChange={(e) => setOwnerMnemonic(e.target.value)}
                />
              </div>
              {ownerMnemonic && ownerAccount && ownerPk && (
                <div>
                  <ul>
                    <li
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => copyToClipboard(ownerMnemonic)}
                    >
                      Copy mnemonic to clipboard
                    </li>
                    <li
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => copyToClipboard(ownerAccount)}
                    >
                      Account: {ownerAccount} (copy)
                    </li>
                    <li
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => copyToClipboard(ownerPk)}
                    >
                      Copy account PK to clipboard
                    </li>
                  </ul>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <h3>Supplier signer wallet</h3>
              <div style={{ padding: 2, backgroundColor: 'rgba(0,0,0,0.1)' }}>
                <p>
                  This account is dedicated to signing the supplier's offers and
                  making offer-related actions like claims, check-in and
                  check-out.
                </p>
                <p>
                  This account has no access to funds and is not able to change
                  the entity configuration.
                </p>
              </div>
              <div>
                <button onClick={() => generateWallet('signer')}>
                  {signerMnemonic ? 'Re-' : ''}Generate signer account mnemonic
                </button>
              </div>
              <div>
                <input
                  style={{ width: '100%' }}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Press `Generate` button above or paste an externally generated mnemonic here"
                  value={signerMnemonic || ''}
                  onChange={(e) => setSignerMnemonic(e.target.value)}
                />
              </div>
              {signerMnemonic && signerAccount && (
                <div>
                  <ul>
                    <li
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => copyToClipboard(signerMnemonic)}
                    >
                      Copy mnemonic to clipboard
                    </li>
                    <li
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => copyToClipboard(signerAccount)}
                    >
                      Account: {signerAccount} (copy)
                    </li>
                  </ul>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <h3>Unique salt</h3>
              <div style={{ padding: 2, backgroundColor: 'rgba(0,0,0,0.1)' }}>
                <p>
                  This unique string is required for the entity registration
                  flow.
                </p>
              </div>
              <div>
                <button onClick={() => setSalt(() => randomSalt())}>
                  {salt ? 'Re-' : ''}Generate salt
                </button>
              </div>
              <div>
                <input
                  style={{ width: '100%' }}
                  placeholder="Press `Generate` button above or paste an externally generated salt string here"
                  value={salt || ''}
                  onChange={(e) => setSalt(e.target.value)}
                />
              </div>
              {salt && (
                <div>
                  <ul>
                    <li
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => copyToClipboard(salt)}
                    >
                      Copy salt to clipboard
                    </li>
                  </ul>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <h3>Supplier Id</h3>
              <div style={{ padding: 2, backgroundColor: 'rgba(0,0,0,0.1)' }}>
                <p>
                  Unique Id that identifies the supplier entity in the protocol
                </p>
              </div>
              <div>
                {supplierId
                  ? <p
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => copyToClipboard(supplierId)}
                    >{supplierId} (copy)</p>
                  : 'Generate the supplier owner and salt first'}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <h3>Registration</h3>
              {!account && (
                <div>
                  You have to connect your wallet to continue: <ConnectButton />
                </div>
              )}
              {account && (
                <div>
                  <button onClick={() => {}}>Register the entity</button>
                </div>
              )}
            </div>
          </div>
        </form>
      </TabPanel>

      <TabPanel id={1} activeTab={selectedTab}>
        <h2>{supplierId}</h2>
      </TabPanel>

      {error && <div style={{ marginTop: 20 }}>🚨 {error}</div>}
    </>
  );
};
