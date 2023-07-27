import { useCallback, useEffect, useState } from 'react';
import { Tabs, TabPanel } from './Tabs.js';
import {
  useConfig,
  useNode,
  useWallet,
} from '@windingtree/sdk-react/providers';
import { UserUpdate } from './UserUpdate.js';
import { UserRegister } from './UserRegister.js';
import { createAdminSignature } from '@windingtree/sdk-node-api/client';

export const LoginWidget = () => {
  const { isAuth, login, setAuth, resetAuth } = useConfig();
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

  const resetForm = useCallback(() => {
    setName('');
    setPwd('');
  }, []);

  const handleUserLogin = useCallback(async () => {
    try {
      if (!node) {
        throw new Error('Not connected to the Node');
      }

      await node.user.login.mutate({
        login: name,
        password: pwd,
      });
      setAuth(name);
      resetForm();
    } catch (error) {
      console.log(error);
      setError((error as Error).message || 'Unknown login error');
    }
  }, [node, name, pwd, setAuth, resetForm]);

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
    setAuth(name);
    resetForm();
  }, [node, name, handleSignature, setAuth, resetForm]);

  const handleAdminLogin = useCallback(async () => {
    if (!node) {
      throw new Error('Not connected to the Node');
    }

    await node.admin.login.mutate({
      login: name,
      password: await handleSignature(),
    });
    setAuth(name);
    resetForm();
  }, [node, name, setAuth, resetForm, handleSignature]);

  const handleLogout = useCallback(async () => {
    try {
      setError(undefined);
      setMessage(undefined);

      if (!node) {
        throw new Error('Not connected to the Node');
      }

      await node.user.logout.mutate();
      resetAuth();
      resetForm();
    } catch (error) {
      console.log(error);
      setError((error as Error).message || 'Unknown logout error');
    }
  }, [node, resetAuth, resetForm]);

  const handleDelete = useCallback(async () => {
    try {
      setError(undefined);
      setMessage(undefined);

      if (!node) {
        throw new Error('Not connected to the Node');
      }

      await node.user.delete.mutate();
      resetAuth();
    } catch (error) {
      console.log(error);
      setError((error as Error).message || 'Unknown user delete error');
    }
  }, [node, resetAuth]);

  const handleAdminAction = useCallback(async () => {
    try {
      setError(undefined);
      setMessage(undefined);

      if (!node) {
        throw new Error('Not connected to the Node');
      }

      switch (adminAction) {
        case 'register':
          await handleAdminRegister();
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
  }, [node, adminAction, name, handleAdminRegister, handleAdminLogin]);

  useEffect(() => {
    resetForm();
  }, [resetForm]);

  return (
    <>
      {isAuth && (
        <div>
          <div>Welcome {login ?? 'user'}</div>
          <div>
            <button onClick={handleLogout}>Log Out</button>
          </div>
          <div>
            <button onClick={handleDelete}>Delete</button>
          </div>
        </div>
      )}
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
        onChange={(id) => {
          setSelectedTab(id);
          resetForm();
          setError(undefined);
          setMessage(undefined);
        }}
      />
      <TabPanel id={0} activeTab={selectedTab}>
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
        <UserUpdate />
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
                  name="register"
                  value="register"
                  checked={adminAction === 'register'}
                />
                <label htmlFor="register">Register</label>
              </div>
              <div>
                <input
                  onChange={() => setAdminAction('login')}
                  type="radio"
                  id="login"
                  name="login"
                  value="login"
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
        <UserRegister />
      </TabPanel>

      {message && <div style={{ marginTop: 20 }}>✅ {message}</div>}

      {error && <div style={{ marginTop: 20 }}>🚨 {error}</div>}
    </>
  );
};
