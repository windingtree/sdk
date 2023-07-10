import { useConfig } from '../providers/ConfigProvider/ConfigProviderContext';

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
                nodeHost: e.target.value,
              })
            }
          />
        </div>
      </form>
    </div>
  );
};
