import { useState } from "react";
import { DynamicQuery } from "./DynamicQuery";

export default function App() {
  return (
    <main>
      <h1>Convex Query Cookbook</h1>
      <TabbedInterface />
    </main>
  );
}

const tabContainerStyle = {
  display: 'flex',
  justifyContent: 'center',
  gap: '10px'
};

const getTabStyle = (isActive: boolean) => ({
  padding: '10px 20px',
  border: 'none',
  borderTopLeftRadius: '8px',
  borderTopRightRadius: '8px',
  cursor: 'pointer',
  backgroundColor: isActive ? '#2563eb' : '#60a5fa',
  color: 'white',
  transition: 'all 0.2s ease',
  transform: isActive ? 'translateY(4px)' : 'none',
  boxShadow: isActive ? 'inset 0 2px 4px rgba(0,0,0,0.2)' : 'none'
});

const TabbedInterface = () => {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    { label: 'Dynamic Query', content: <DynamicQuery /> },
    { label: 'Profile', content: 'This is the Profile section.' },
  ];

  return (
    <>
      <div style={tabContainerStyle}>
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            style={getTabStyle(activeTab === index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs[activeTab].content}
    </>
  );
};

