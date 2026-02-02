
import React, { useState } from 'react';
import Login from './components/Login';
import Layout from './components/Layout';
import Overview from './components/Overview';
import MetadataDictionary from './components/MetadataDictionary';
import ElementsGPT from './components/ElementsGPT';
import SoqlExplorer from './components/SoqlExplorer';
import DiagramEditor from './components/DiagramEditor';
import { authenticate } from './services/salesforceService';
import { UserCredentials, OrgMetadata } from './types';

function App() {
  const [user, setUser] = useState<UserCredentials | null>(null);
  const [orgData, setOrgData] = useState<OrgMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const handleLogin = async (creds: UserCredentials) => {
    setLoading(true);
    setError(null);
    try {
      const data = await authenticate(creds);
      setUser(creds);
      setOrgData(data);
    } catch (err: any) {
      console.error("Login failed", err);
      setError(err.message || "Login failed. Please verify credentials and CORS settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setOrgData(null);
    setActiveTab('overview');
    setError(null);
  };

  if (!user || !orgData) {
    return (
        <>
            <Login onLogin={handleLogin} loading={loading} />
            {error && (
                <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg z-50 max-w-md">
                    <strong className="font-bold">Connection Error: </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            )}
        </>
    );
  }

  return (
    <Layout 
      activeTab={activeTab} 
      onTabChange={setActiveTab} 
      onLogout={handleLogout}
      orgName={orgData.orgName}
    >
      {activeTab === 'overview' && <Overview data={orgData} />}
      {activeTab === 'dictionary' && <MetadataDictionary data={orgData} />}
      {activeTab === 'diagrams' && <DiagramEditor metadata={orgData} />}
      {activeTab === 'soql' && <SoqlExplorer metadata={orgData} />}
      {activeTab === 'gpt' && <ElementsGPT metadata={orgData} />}
    </Layout>
  );
}

export default App;
