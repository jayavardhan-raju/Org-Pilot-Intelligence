
import React from 'react';
import { 
  Database, 
  MessageSquare, 
  LogOut, 
  LayoutDashboard,
  Cloud,
  Code,
  Workflow
} from 'lucide-react';
import { HelpTooltip } from './HelpTooltip';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  orgName: string;
}

const NavItem = ({ 
  icon: Icon, 
  label, 
  id, 
  active, 
  onClick,
  helpText
}: { 
  icon: any; 
  label: string; 
  id: string; 
  active: boolean; 
  onClick: () => void;
  helpText: string;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors duration-200 group ${
      active 
        ? 'bg-blue-600 text-white shadow-md' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
  >
    <div className="flex items-center space-x-3">
        <Icon size={20} />
        <span className="font-medium">{label}</span>
    </div>
    <div className={`opacity-0 group-hover:opacity-100 transition-opacity ${active ? 'text-blue-200' : 'text-slate-500'}`} onClick={(e) => e.stopPropagation()}>
         <HelpTooltip text={helpText} />
    </div>
  </button>
);

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, onLogout, orgName }) => {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col flex-shrink-0 shadow-xl z-20">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Cloud size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">OrgPilot</h1>
              <p className="text-xs text-slate-400">Metadata Intelligence</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-2">
          <NavItem 
            icon={LayoutDashboard} 
            label="Overview" 
            id="overview" 
            active={activeTab === 'overview'} 
            onClick={() => onTabChange('overview')}
            helpText="Module 11: High-level metrics, org health score, and component distribution."
          />
          <NavItem 
            icon={Database} 
            label="Metadata Dictionary" 
            id="dictionary" 
            active={activeTab === 'dictionary'} 
            onClick={() => onTabChange('dictionary')}
            helpText="Modules 2-12: Full hierarchical view of metadata, dependencies, access, and documentation."
          />
          <NavItem 
            icon={Workflow} 
            label="Diagrams" 
            id="diagrams" 
            active={activeTab === 'diagrams'} 
            onClick={() => onTabChange('diagrams')}
            helpText="Enterprise Business Process Mapping (UPN) with Impact Analysis."
          />
          <NavItem 
            icon={Code} 
            label="SOQL Explorer" 
            id="soql" 
            active={activeTab === 'soql'} 
            onClick={() => onTabChange('soql')}
            helpText="Direct data access. Query records to verify metadata assumptions."
          />
          <NavItem 
            icon={MessageSquare} 
            label="ElementsGPT" 
            id="gpt" 
            active={activeTab === 'gpt'} 
            onClick={() => onTabChange('gpt')}
            helpText="Module I: Natural language AI assistant for your Org metadata."
          />
        </div>

        <div className="p-4 border-t border-slate-700 bg-slate-800/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Connected to</span>
              <span className="font-medium truncate max-w-[150px]" title={orgName}>{orgName}</span>
            </div>
            <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-md transition-colors border border-slate-700"
          >
            <LogOut size={16} />
            <span>Disconnect</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            {activeTab === 'overview' && 'Org Overview'}
            {activeTab === 'dictionary' && 'Metadata Dictionary'}
            {activeTab === 'diagrams' && 'Enterprise Diagramming'}
            {activeTab === 'soql' && 'SOQL Explorer'}
            {activeTab === 'gpt' && 'ElementsGPT Assistant'}
          </h2>
          <div className="flex items-center space-x-4">
             <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-100">
                Enterprise Edition
             </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-8 bg-slate-50/50 relative">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
