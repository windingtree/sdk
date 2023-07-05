import { useState } from 'react';
import { AccountWidget } from '../../react-libs/src/providers/WalletProvider/AccountWidget.js';
import { useNode } from './providers/NodeProvider/NodeProviderContext.js';
import { Tabs, TabPanel } from './components/Tabs.js';
import { LoginWidget } from './components/LoginWidget.js';
import { ConfigForm } from './components/ConfigForm.js';

/**
 * Main application component
 */
export const App = () => {
  const { nodeConnected, nodeError } = useNode();
  const [selectedTab, setSelectedTab] = useState<number>(0);

  return (
    <>
      <div
        style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}
      >
        <div style={{ flex: 1 }}>
          <h1>Node manager</h1>
        </div>
        <AccountWidget />
      </div>
      <div>{nodeConnected && <strong>✅ Connected</strong>}</div>
      <Tabs
        tabs={[
          {
            id: 0,
            title: 'Access',
            active: true,
          },
          {
            id: 1,
            title: 'Configuration',
          },
        ]}
        onChange={setSelectedTab}
      />
      <TabPanel id={0} activeTab={selectedTab}>
        <LoginWidget />
      </TabPanel>
      <TabPanel id={1} activeTab={selectedTab}>
        <ConfigForm />
      </TabPanel>

      {nodeError && <div style={{ marginTop: 20 }}>🚨 {nodeError}</div>}
    </>
  );
};
