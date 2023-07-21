import { useCallback, useEffect, useState } from 'react';
import { useConfig, useNode } from '@windingtree/sdk-react/providers';

/**
 * Updates users password
 */
export const UserUpdate = () => {
  const { isAuth, login } = useConfig();
  const { node } = useNode();
  const [pwd, setPwd] = useState<string>('');
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const resetForm = useCallback(() => {
    setPwd('');
  }, []);

  const handleUpdate = useCallback(async () => {
    setError(undefined);
    setMessage(undefined);

    if (!node) {
      return;
    }

    await node.user.update.mutate({
      password: pwd,
    });
    setMessage(`User ${login} successfully updated`);
    resetForm();
  }, [node, login, pwd, resetForm]);

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
      <h2>Update password:</h2>
      <div style={{ marginTop: 20 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleUpdate();
          }}
        >
          <div style={{ marginBottom: 10 }}>
            <div>
              <strong>Password:</strong>
            </div>
            <div>
              <input value={pwd} onChange={(e) => setPwd(e.target.value)} />
            </div>
          </div>
          <div>
            <button type="submit">Update</button>
          </div>
        </form>
      </div>

      {message && <div style={{ marginTop: 20 }}>✅ {message}</div>}

      {error && <div style={{ marginTop: 20 }}>🚨 {error}</div>}
    </>
  );
};
