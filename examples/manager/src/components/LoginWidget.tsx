import { useCallback, useState } from 'react';
import { useConfig } from '../providers/ConfigProvider/ConfigProviderContext';
import { useNode } from '../providers/NodeProvider/NodeProviderContext';
import { useWallet } from '../../../react-libs/src/providers/WalletProvider/WalletProviderContext';
import { createAdminSignature } from '../../../../src/node/api/client.js';
import { Tabs, TabPanel } from './Tabs.js';

export const LoginWidget = () => {
  const { isAuth, login, setConfig, resetAuth } = useConfig();
  const { node, nodeConnected } = useNode();
  const { isConnected, walletClient } = useWallet();
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const [name, setName] = useState<string>('');
  const [pwd, setPwd] = useState<string>('');
  const [adminAction, setAdminAction] = useState<'register' | 'login'>(
    'register',
  );
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const handleUserLogin = useCallback(async () => {
    try {
      if (!node) {
        throw new Error('Not connected to the Node');
      }

      await node.user.login.mutate({
        login: name,
        password: pwd,
      });
    } catch (error) {
      console.log(error);
      setError((error as Error).message || 'Unknown login error');
    }
  }, [node, name, pwd]);

  const handleSignature = useCallback(async () => {
    if (!walletClient) {
      throw new Error('Wallet not connected yet');
    }

    return await createAdminSignature(walletClient);
  }, [walletClient]);

  const handleAdminRegister = useCallback(async () => {
    const sign = await handleSignature();

    if (!node) {
      throw new Error('Not connected to the Node');
    }

    await node.admin.register.mutate({
      login: name,
      password: sign,
    });
  }, [node, name, handleSignature]);

  const handleAdminLogin = useCallback(async () => {
    if (!node) {
      throw new Error('Not connected to the Node');
    }

    await node.admin.login.mutate({
      login: name,
      password: await handleSignature(),
    });
  }, [node, name, handleSignature]);

  const handleAdminAction = useCallback(async () => {
    try {
      if (!node) {
        throw new Error('Not connected to the Node');
      }

      setError(undefined);
      setMessage(undefined);

      switch (adminAction) {
        case 'register':
          await handleAdminRegister();
          setConfig({ login: name });
          setAdminAction('login');
          setMessage(`Admin "${name}" successfully registered. Please log in.`);
          break;
        case 'login':
          await handleAdminLogin();
          break;
        default:
          throw new Error('Unknown admin action');
      }
    } catch (error) {
      console.log(error);
      setError((error as Error).message || 'Unknown login error');
    }
  }, [
    node,
    adminAction,
    name,
    setConfig,
    handleAdminRegister,
    handleAdminLogin,
  ]);

  return (
    <>
      <Tabs
        tabs={[
          {
            id: 0,
            title: 'Manager',
            active: true,
          },
          {
            id: 1,
            title: 'Admin',
          },
        ]}
        onChange={setSelectedTab}
      />
      <TabPanel id={0} activeTab={selectedTab}>
        {isAuth && <div>Welcome {login ?? 'user'}</div>}
        {!isAuth && nodeConnected && (
          <div style={{ marginTop: 20 }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUserLogin();
              }}
            >
              <div style={{ marginBottom: 10 }}>
                <div>
                  <strong>Name:</strong>
                </div>
                <div>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div>
                  <strong>Password:</strong>
                </div>
                <div>
                  <input value={pwd} onChange={(e) => setPwd(e.target.value)} />
                </div>
              </div>
              <div>
                <button type="submit">Log In</button>
              </div>
            </form>
          </div>
        )}
      </TabPanel>
      <TabPanel id={1} activeTab={selectedTab}>
        {!isConnected && <div>Please connect your wallet first</div>}
        {isConnected && !isAuth && (
          <div style={{ padding: 10, backgroundColor: 'white' }}>
            <div style={{ marginBottom: 5 }}>
              <div>
                <input
                  onChange={() => setAdminAction('register')}
                  type="radio"
                  id="register"
                  name="drone"
                  value="huey"
                  checked={adminAction === 'register'}
                />
                <label htmlFor="register">Register</label>
              </div>
              <div>
                <input
                  onChange={() => setAdminAction('login')}
                  type="radio"
                  id="login"
                  name="drone"
                  value="dewey"
                  checked={adminAction === 'login'}
                />
                <label htmlFor="login">Login</label>
              </div>
            </div>
            <div>
              <strong>Name:</strong>
            </div>
            <div style={{ marginBottom: 5 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <button onClick={handleAdminAction}>Send with wallet</button>
            </div>
          </div>
        )}
        {isAuth && (
          <div>
            <div>Welcome {login ?? 'user'}</div>
            <div>
              <button onClick={() => resetAuth()}>Log Out</button>
            </div>
          </div>
        )}
      </TabPanel>

      {message && <div style={{ marginTop: 20 }}>✅ {message}</div>}

      {error && <div style={{ marginTop: 20 }}>🚨 {error}</div>}
    </>
  );
};
