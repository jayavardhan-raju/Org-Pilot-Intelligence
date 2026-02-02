import React, { useState } from 'react';
import { Cloud, Lock, User, Key, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { UserCredentials } from '../types';

interface LoginProps {
  onLogin: (creds: UserCredentials) => void;
  loading: boolean;
}

const Login: React.FC<LoginProps> = ({ onLogin, loading }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [orgType, setOrgType] = useState<'Production' | 'Sandbox'>('Production');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // We no longer need client ID/Secret for SOAP login
    onLogin({ username, password, securityToken: token, orgType });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30 transform rotate-3">
            <Cloud size={40} className="text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-slate-900">
          OrgPilot Intelligence
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Connect your Salesforce Organization
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-xl sm:px-10 border border-slate-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700">
                Salesforce Username
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 sm:text-sm border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 border"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 sm:text-sm border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 border"
                />
              </div>
            </div>

            <div>
              <label htmlFor="token" className="block text-sm font-medium text-slate-700">
                Security Token
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="token"
                  name="token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="block w-full pl-10 sm:text-sm border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 border"
                />
              </div>
            </div>

            <div>
              <label htmlFor="orgType" className="block text-sm font-medium text-slate-700">
                Environment
              </label>
              <div className="mt-1">
                <select
                  id="orgType"
                  name="orgType"
                  value={orgType}
                  onChange={(e) => setOrgType(e.target.value as any)}
                  className="block w-full pl-3 pr-10 py-2.5 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg border"
                >
                  <option value="Production">Production / Developer Edition</option>
                  <option value="Sandbox">Sandbox</option>
                </select>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {loading ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <>
                    Connect Organization <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </div>
            
            <p className="text-xs text-center text-slate-500">
               Note: If connection fails, ensure you are using a Developer Edition or Sandbox.
               <br/>Requests are routed via a CORS proxy for browser compatibility.
            </p>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">Secure Connection</span>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="flex items-center justify-center space-x-2 text-xs text-slate-500 bg-slate-50 p-2 rounded">
                 <ShieldCheck size={14} className="text-green-500"/>
                 <span>Encryption Enabled</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-xs text-slate-500 bg-slate-50 p-2 rounded">
                 <CheckCircle2 size={14} className="text-blue-500"/>
                 <span>API Ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;