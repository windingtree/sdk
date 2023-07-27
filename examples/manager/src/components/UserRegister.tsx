import { useCallback, useEffect, useState } from 'react';
import { useConfig, useNode } from '@windingtree/sdk-react/providers';

/**
 * Register a new user
 */
export const UserRegister = () => {
  const { isAuth } = useConfig();
  const { node } = useNode();
  const [name, setName] = useState<string>('');
  const [pwd, setPwd] = useState<string>('');
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const resetForm = useCallback(() => {
    setName('');
    setPwd('');
  }, []);

  const handleRegister = useCallback(async () => {
    setError(undefined);
    setMessage(undefined);

    if (!node) {
      return;
    }

    await node.user.register.mutate({
      login: name,
      password: pwd,
    });
    setMessage(`User ${name} successfully registered`);
    resetForm();
  }, [node, name, pwd, resetForm]);

  useEffect(() => {
    resetForm();
    setError(undefined);
    setMessage(undefined);
  }, [resetForm]);

  if (!isAuth) {
    return null;
  }

  return (
    <>
      <h2>Register manager:</h2>
      <div style={{ marginTop: 20 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRegister();
          }}
        >
          <div style={{ marginBottom: 10 }}>
            <div>
              <strong>Name:</strong>
            </div>
            <div>
              <input value={name} onChange={(e) => setName(e.target.value)} />
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
            <button type="submit">Register</button>
          </div>
        </form>
      </div>

      {message && <div style={{ marginTop: 20 }}>✅ {message}</div>}

      {error && <div style={{ marginTop: 20 }}>🚨 {error}</div>}
    </>
  );
};
