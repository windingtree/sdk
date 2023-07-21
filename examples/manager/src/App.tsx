import { useState } from 'react';
import { Tabs, TabPanel } from './components/Tabs.js';
import { LoginWidget } from './components/LoginWidget.js';
import { ConfigForm } from './components/ConfigForm.js';
import { DealSeek } from './components/DealSeek.js';
import { Supplier } from './components/Supplier.js';
import { AccountWidget, useNode } from '@windingtree/sdk-react/providers';

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
            title: 'Deals',
            active: true,
          },
          {
            id: 1,
            title: 'Access',
          },
          {
            id: 2,
            title: 'Configuration',
          },
          {
            id: 3,
            title: 'Supplier setup',
          },
        ]}
        onChange={setSelectedTab}
      />
      <TabPanel id={0} activeTab={selectedTab}>
        <DealSeek />
      </TabPanel>
      <TabPanel id={1} activeTab={selectedTab}>
        <LoginWidget />
      </TabPanel>
      <TabPanel id={2} activeTab={selectedTab}>
        <ConfigForm />
      </TabPanel>
      <TabPanel id={3} activeTab={selectedTab}>
        <Supplier />
      </TabPanel>

      {nodeError && <div style={{ marginTop: 20 }}>🚨 {nodeError}</div>}
    </>
  );
};
