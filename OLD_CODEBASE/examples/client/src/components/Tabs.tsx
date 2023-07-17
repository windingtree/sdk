import { useState, PropsWithChildren } from 'react';

export interface Tab {
  id: number;
  title: string;
  active?: boolean;
}

export interface TabsProps {
  tabs: Tab[];
  onChange: (tabId: number) => void;
}

export interface TabPanelProps extends PropsWithChildren {
  id: number;
  activeTab: number;
}

// Simple tabs component
export const Tabs = ({ tabs, onChange }: TabsProps) => {
  const [tabsState, setTabsState] = useState<Tab[]>(tabs);

  const setActive = (id: number) => {
    const updatedTabs = tabsState.map((t) => ({
      ...t,
      active: t.id === id,
    }));
    setTabsState(updatedTabs);
    onChange(id);
  };

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: 20,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {tabsState.map((t, index) => (
        <div
          key={index}
          style={{
            padding: '0px 10px 0px 10px',
            cursor: 'pointer',
            backgroundColor: t.active ? 'rgba(0,0,0,0.05)' : 'transparent',
          }}
          onClick={() => setActive(t.id)}
        >
          <h2>{t.title}</h2>
        </div>
      ))}
    </div>
  );
};

// Simple tab panel
export const TabPanel = ({ id, activeTab, children }: TabPanelProps) => (
  <div
    style={{
      display: id === activeTab ? 'block' : 'none',
      padding: 15,
      backgroundColor: 'rgba(0,0,0,0.05)',
    }}
  >
    {children}
  </div>
);
