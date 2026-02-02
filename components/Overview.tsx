
import React from 'react';
import { OrgMetadata } from '../types';
import { Layers, Database, Code, ShieldAlert, BarChart3, ArrowUpRight } from 'lucide-react';
import { HelpTooltip } from './HelpTooltip';

interface OverviewProps {
  data: OrgMetadata;
}

const StatCard = ({ title, value, icon: Icon, color, trend, helpText }: any) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between relative group">
    <div>
      <div className="flex items-center space-x-1">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <HelpTooltip text={helpText} size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <h3 className="text-2xl font-bold text-slate-900 mt-2">{value}</h3>
      {trend && (
        <div className="flex items-center mt-2 text-xs font-medium text-green-600">
          <ArrowUpRight size={12} className="mr-1" />
          <span>{trend}</span>
        </div>
      )}
    </div>
    <div className={`p-3 rounded-lg ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
  </div>
);

const Overview: React.FC<OverviewProps> = ({ data }) => {
  const objects = data?.objects || [];
  const totalObjects = objects.length;
  const customObjects = objects.filter(o => o.isCustom).length;
  
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Objects" 
          value={totalObjects} 
          icon={Layers} 
          color="bg-blue-500"
          helpText="Count of all objects (Standard + Custom) visible to the API user."
        />
        <StatCard 
          title="Custom Objects" 
          value={customObjects} 
          icon={Database} 
          color="bg-indigo-500"
          helpText="Objects created by admins (ending in __c)."
        />
        <StatCard 
          title="Standard Objects" 
          value={totalObjects - customObjects} 
          icon={Code} 
          color="bg-purple-500"
          helpText="Out-of-the-box Salesforce objects (Account, Contact, etc.)."
        />
        <StatCard 
          title="API Version" 
          value="v60.0" 
          icon={BarChart3} 
          color="bg-emerald-500"
          helpText="Current API version used for metadata sync."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800 flex items-center">
                Object Distribution
                <HelpTooltip text="Breakdown of object types and namespace usage." className="ml-2" />
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">
                    Your org contains <strong>{customObjects}</strong> custom objects and <strong>{totalObjects - customObjects}</strong> standard objects.
                    Use the Metadata Dictionary to explore field definitions and record counts for specific objects.
                </p>
              </div>
              
              <div>
                 <h4 className="text-sm font-medium text-slate-700 mb-2">Namespace Prefix Analysis</h4>
                 <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(objects.map(o => o.keyPrefix).filter(Boolean))).slice(0, 10).map(prefix => (
                        <span key={prefix} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded border border-slate-200 font-mono">
                            {prefix}
                        </span>
                    ))}
                    {objects.length > 0 && objects.every(o => !o.keyPrefix) && (
                        <span className="text-sm text-slate-400 italic">No key prefixes found.</span>
                    )}
                 </div>
              </div>
            </div>
            <div className="mt-8 p-4 bg-yellow-50 rounded-lg border border-yellow-100 flex items-start gap-3">
              <ShieldAlert className="text-yellow-600 shrink-0 mt-0.5" size={18} />
              <div>
                <h4 className="text-sm font-medium text-yellow-800">API Usage Note</h4>
                <p className="text-xs text-yellow-700 mt-1">
                  This dashboard uses the Metadata API (Global Describe). Detailed field analysis and record counts are fetched on-demand in the Dictionary tab to preserve API limits.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
           <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800 flex items-center">
                Org Health Score
                <HelpTooltip text="Composite metric based on optimization status, field usage, and test coverage." className="ml-2" />
            </h3>
           </div>
           <div className="p-6 flex flex-col items-center justify-center">
              <div className="relative w-40 h-40 flex items-center justify-center">
                 <svg className="w-full h-full" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#f1f5f9"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831"
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="3"
                      strokeDasharray="85, 100"
                    />
                 </svg>
                 <div className="absolute flex flex-col items-center">
                    <span className="text-4xl font-bold text-slate-800">--</span>
                    <span className="text-xs uppercase font-semibold text-slate-400">Good</span>
                 </div>
              </div>
              <div className="mt-6 w-full space-y-3">
                 <p className="text-center text-xs text-slate-500">
                    Health score calculation requires extensive metadata analysis. Please use the Dictionary feature to analyze specific areas.
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
