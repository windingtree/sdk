import { useState, useCallback, useEffect } from 'react';
import { Address, ContractFunctionResult, Hash, getAddress } from 'viem';
import { entitiesRegistryABI, randomSalt } from '@windingtree/contracts';
import {
  ConfigActions,
  ConnectButton,
  useConfig,
  useContracts,
  useWallet,
} from '@windingtree/sdk-react/providers';
import {
  deriveAccount,
  generateMnemonic,
  getPk,
  supplierId as createSupplierId,
} from '@windingtree/sdk-utils';
import { CustomConfig } from '../main.js';
import { TabPanel, Tabs } from './Tabs.js';
import { copyToClipboard, formatBalance } from '@windingtree/sdk-react/utils';

export const Supplier = () => {
  const { account, publicClient, walletClient } = useWallet();
  const { contracts } = useContracts();
  const { supplierId, setConfig } = useConfig<CustomConfig>();
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const [ownerMnemonic, setOwnerMnemonic] = useState<string | undefined>();
  const [signerMnemonic, setSignerMnemonic] = useState<string | undefined>();
  const [ownerAccount, setOwnerAccount] = useState<Address | undefined>();
  const [ownerPk, setOwnerPk] = useState<string | undefined>();
  const [signerAccount, setSignerAccount] = useState<Address | undefined>();
  const [salt, setSalt] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState<boolean>(false);
  const [tx, setTx] = useState<string | undefined>();
  const [txMessage, setTxMessage] = useState<string | undefined>();
  const [entityInfo, setEntityInfo] = useState<
    ContractFunctionResult<typeof entitiesRegistryABI, 'getEntity'> | undefined
  >();
  const [depositBalance, setDepositBalance] = useState<string | undefined>();
  const [depositValue, setDepositValue] = useState<string | undefined>();
  const [withdrawValue, setWithdrawValue] = useState<string | undefined>();
  const [signerAddress, setSignerAddress] = useState<Address | undefined>();

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

  const generateEnv = useCallback(() => {
    return `
EXAMPLE_ENTITY_SIGNER_MNEMONIC=${signerMnemonic}
EXAMPLE_ENTITY_ID=${supplierId}
EXAMPLE_ENTITY_OWNER_ADDRESS=${ownerAccount}
`;
  }, [signerMnemonic, supplierId, ownerAccount]);

  const handleRegister = useCallback(async () => {
    try {
      setError(undefined);
      setTx(undefined);
      setTxMessage(undefined);
      setLoading(true);

      if (!contracts || !walletClient) {
        throw new Error('Contracts not ready');
      }

      if (!salt) {
        throw new Error('Salt required');
      }

      if (!supplierId) {
        throw new Error('Supplier Id must be calculated');
      }

      if (!ownerAccount) {
        throw new Error('Please generate the entity owner account first');
      }

      const [address] = await walletClient.getAddresses();

      if (address !== getAddress(ownerAccount)) {
        throw new Error(
          'You have to switch to the entity owner account in the Metamask',
        );
      }

      const balance = await publicClient.getBalance({ address });

      if (Number(balance) === 0) {
        throw new Error(
          'You have to top up your account to be able to send transactions',
        );
      }

      await contracts.registerEntity(
        salt as Hash,
        address,
        walletClient,
        setTx,
      );

      setTxMessage(`Entity ${supplierId} successfully registered`);
      setLoading(false);
    } catch (error) {
      console.log(error);
      setError((error as Error).message || 'Unknown setup error');
      setLoading(false);
    }
  }, [contracts, publicClient, walletClient, salt, supplierId, ownerAccount]);

  const handleGetEntity = useCallback(async () => {
    try {
      setError(undefined);

      if (!contracts) {
        throw new Error('Contracts not ready');
      }

      if (!supplierId) {
        throw new Error(
          'Supplier Id must be calculated on Registration step or added on View step',
        );
      }

      setEntityInfo(await contracts.getEntity(supplierId));
    } catch (error) {
      console.log(error);
      setError((error as Error).message || 'Unknown setup error');
      setEntityInfo(undefined);
    }
  }, [contracts, supplierId]);

  const handleGetDepositBalance = useCallback(async () => {
    try {
      setError(undefined);

      if (!contracts) {
        throw new Error('Contracts not ready');
      }

      if (!supplierId) {
        throw new Error(
          'Supplier Id must be calculated on Registration step or added on View step',
        );
      }

      setDepositBalance(String(await contracts.balanceOfEntity(supplierId)));
    } catch (error) {
      console.log(error);
      setError((error as Error).message || 'Unknown setup error');
      setDepositBalance('0');
    }
  }, [contracts, supplierId]);

  const handleAddDeposit = useCallback(
    async (value: bigint) => {
      try {
        setError(undefined);
        setTx(undefined);
        setTxMessage(undefined);
        setLoading(true);

        if (!contracts || !walletClient) {
          throw new Error('Contracts not ready');
        }

        if (!supplierId) {
          throw new Error(
            'Supplier Id must be calculated on Registration step or added on View step',
          );
        }

        await contracts.addEntityDeposit(
          supplierId,
          value,
          walletClient,
          setTx,
        );

        setTxMessage('Deposit successfully added');
        setLoading(false);
      } catch (error) {
        console.log(error);
        setError((error as Error).message || 'Unknown setup error');
        setLoading(false);
      }
    },
    [contracts, supplierId, walletClient],
  );

  const handleWithdrawDeposit = useCallback(
    async (value: bigint) => {
      try {
        setError(undefined);
        setTx(undefined);
        setTxMessage(undefined);
        setLoading(true);

        if (!contracts || !walletClient) {
          throw new Error('Contracts not ready');
        }

        if (!supplierId) {
          throw new Error(
            'Supplier Id must be calculated on Registration step or added on View step',
          );
        }

        await contracts.withdrawEntityDeposit(
          supplierId,
          value,
          walletClient,
          setTx,
        );

        setTxMessage('Deposit successfully withdrawn');
        setLoading(false);
      } catch (error) {
        console.log(error);
        setError((error as Error).message || 'Unknown setup error');
        setLoading(false);
      }
    },
    [contracts, supplierId, walletClient],
  );

  const handleChangeSigner = useCallback(
    async (signer: Address) => {
      try {
        setError(undefined);
        setTx(undefined);
        setTxMessage(undefined);
        setLoading(true);

        if (!contracts || !walletClient) {
          throw new Error('Contracts not ready');
        }

        if (!supplierId) {
          throw new Error(
            'Supplier Id must be calculated on Registration step or added on View step',
          );
        }

        await contracts.changeEntitySigner(
          supplierId,
          signer,
          walletClient,
          setTx,
        );

        setTxMessage('Signer successfully updated');
        setLoading(false);
      } catch (error) {
        console.log(error);
        setError((error as Error).message || 'Unknown setup error');
        setLoading(false);
      }
    },
    [contracts, supplierId, walletClient],
  );

  const handleToggleEntity = useCallback(async () => {
    try {
      setError(undefined);
      setTx(undefined);
      setTxMessage(undefined);
      setLoading(true);

      if (!contracts || !walletClient) {
        throw new Error('Contracts not ready');
      }

      if (!supplierId) {
        throw new Error(
          'Supplier Id must be calculated on Registration step or added on View step',
        );
      }

      await contracts.toggleEntity(supplierId, walletClient, setTx);

      setTxMessage('Signer successfully updated');
      setLoading(false);
    } catch (error) {
      console.log(error);
      setError((error as Error).message || 'Unknown setup error');
      setLoading(false);
    }
  }, [contracts, supplierId, walletClient]);

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
    if ((!ownerAccount || !salt) && !supplierId) {
      setConfig({
        type: ConfigActions.SET_CONFIG,
        payload: {
          supplierId: undefined,
        },
      });
    } else if (ownerAccount && salt) {
      const id = createSupplierId(salt as Hash, ownerAccount);
      setConfig({
        type: ConfigActions.SET_CONFIG,
        payload: {
          supplierId: id,
        },
      });
    }
  }, [setConfig, ownerAccount, salt, supplierId]);

  useEffect(() => {
    if (supplierId && account) {
      handleGetEntity();
      handleGetDepositBalance();
    } else {
      setEntityInfo(undefined);
      setDepositBalance('0');
    }
  }, [handleGetEntity, handleGetDepositBalance, supplierId, account]);

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
                It is not recommended to use this UI for the `production` setup
                of the entity.
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
              {!supplierId && (
                <div>Generate the supplier owner and salt first</div>
              )}
              {supplierId && (
                <div>
                  <ul>
                    <li
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => copyToClipboard(supplierId)}
                    >
                      {supplierId} (copy)
                    </li>
                    <li
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => copyToClipboard(generateEnv())}
                    >
                      Copy the node `.env` file content to clipboard
                    </li>
                  </ul>
                </div>
              )}
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
                  <button onClick={handleRegister} disabled={loading}>
                    Register the entity{loading ? '...' : ''}
                  </button>
                </div>
              )}
            </div>
          </div>
        </form>
      </TabPanel>

      <TabPanel id={1} activeTab={selectedTab}>
        <form onSubmit={(e) => e.preventDefault()}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!account && (
              <div>
                You have to connect your wallet to continue: <ConnectButton />
              </div>
            )}
            {account && (
              <>
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 5 }}
                >
                  {!supplierId && (
                    <>
                      <div
                        style={{
                          padding: 2,
                          backgroundColor: 'rgba(0,0,0,0.1)',
                        }}
                      >
                        <p>
                          This Id can be automatically generated on the Register
                          step or added bellow
                        </p>
                      </div>
                      <div>
                        <input
                          style={{ width: '100%' }}
                          placeholder="Paste an externally generated salt string here"
                          value={supplierId || ''}
                          onChange={(e) =>
                            setConfig({
                              type: ConfigActions.SET_CONFIG,
                              payload: {
                                supplierId: e.target.value as Hash,
                              },
                            })
                          }
                        />
                      </div>
                    </>
                  )}
                  {supplierId && (
                    <h3
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => handleGetEntity()}
                    >
                      Entity Id: {supplierId} (refresh)
                    </h3>
                  )}
                  {entityInfo && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 5,
                      }}
                    >
                      {Object.keys(entityInfo).map((k, i) => (
                        <div key={i}>
                          <strong>{k}</strong>: {String((entityInfo as any)[k])}
                        </div>
                      ))}
                    </div>
                  )}
                  {depositBalance && (
                    <div>
                      <strong>Deposit balance:</strong>{' '}
                      {formatBalance(BigInt(depositBalance), 4)}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </form>
      </TabPanel>

      <TabPanel id={2} activeTab={selectedTab}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!account && (
            <div>
              You have to connect your wallet to continue: <ConnectButton />
            </div>
          )}
          {account &&
            entityInfo &&
            getAddress(account) !== entityInfo.owner && (
              <div style={{ marginTop: 10, color: 'red' }}>
                You have to switch your Metamask account to {entityInfo.owner}
              </div>
            )}
          {account && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {supplierId && <h3>Entity Id: {supplierId}</h3>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <h3>Add deposit</h3>
                <div>
                  <input
                    style={{ width: '100%' }}
                    placeholder="deposit value in WEI"
                    value={depositValue || ''}
                    onChange={(e) => setDepositValue(e.target.value)}
                  />
                </div>
                <div>
                  <button
                    disabled={loading || !depositValue}
                    onClick={(e) => handleAddDeposit(BigInt(depositValue ?? 0))}
                  >
                    Send add deposit transaction{loading ? '...' : ''}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <h3>Withdraw deposit</h3>
                {depositBalance && (
                  <div
                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => setWithdrawValue(depositBalance)}
                  >
                    <strong>Available to withdraw:</strong> {depositBalance}{' '}
                    (click to use)
                  </div>
                )}
                <div>
                  <input
                    style={{ width: '100%' }}
                    placeholder="withdraw value in WEI"
                    value={withdrawValue || ''}
                    onChange={(e) => setWithdrawValue(e.target.value)}
                  />
                </div>
                <div>
                  <p>
                    Point your attention that this action will send two
                    transactions:
                  </p>
                  <ul>
                    <li>Tokens approval transaction</li>
                    <li>Deposit transaction</li>
                  </ul>
                </div>
                <div>
                  <button
                    disabled={loading || !withdrawValue}
                    onClick={(e) =>
                      handleWithdrawDeposit(BigInt(withdrawValue ?? 0))
                    }
                  >
                    Send withdraw deposit transaction{loading ? '...' : ''}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <h3>Change signer</h3>
                <div>
                  <input
                    style={{ width: '100%' }}
                    placeholder="signer account address"
                    value={signerAddress || ''}
                    onChange={(e) =>
                      setSignerAddress(e.target.value as Address)
                    }
                  />
                </div>
                <div>
                  <button
                    disabled={loading || !signerAddress}
                    onClick={(e) => handleChangeSigner(signerAddress!)}
                  >
                    Send change signer transaction{loading ? '...' : ''}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <h3>Toggle entity</h3>
                <div>
                  <button
                    disabled={loading}
                    onClick={(e) => handleToggleEntity()}
                  >
                    Send entity toggle transaction{loading ? '...' : ''}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </TabPanel>

      {tx && <div style={{ marginTop: 20 }}>Tx hash: {tx}</div>}

      {txMessage && <div style={{ marginTop: 20 }}>✅ {txMessage}</div>}

      {error && <div style={{ marginTop: 20 }}>🚨 {error}</div>}
    </>
  );
};
