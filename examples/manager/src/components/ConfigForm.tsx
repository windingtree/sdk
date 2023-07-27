import { ConfigActions, useConfig } from '@windingtree/sdk-react/providers';

export const ConfigForm = () => {
  const { nodeHost, setConfig } = useConfig();

  return (
    <div style={{ marginTop: 20 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <strong>Node host:</strong>
        </div>
        <div>
          <input
            value={nodeHost ?? ''}
            onChange={(e) =>
              setConfig({
                type: ConfigActions.SET_CONFIG,
                payload: {
                  nodeHost: e.target.value,
                },
              })
            }
          />
        </div>
      </form>
    </div>
  );
};
