
import React, { useEffect, useState } from 'react';
import { fetchObjectDetails, fetchRecordWithRelated, fetchObjectLayouts } from '../services/salesforceService';
import { summarizeRecord } from '../services/geminiService';
import { OrgMetadata, SChildRelationship, PageLayout, LayoutSection, LayoutItem, SField, LayoutRow } from '../types';
import { X, Loader2, Database, ExternalLink, Copy, Check, AlertCircle, Users, Brain, List, Layout, Eye, EyeOff } from 'lucide-react';
import { HelpTooltip } from './HelpTooltip';

interface RecordDetailModalProps {
  recordId: string;
  objectType: string;
  orgMetadata: OrgMetadata;
  onClose: () => void;
}

type Tab = 'details' | 'summary' | 'related';

// Helper to create a fallback layout if API returns none
const createDefaultLayout = (objectType: string, fields: SField[]): PageLayout => {
    const layoutRows: LayoutRow[] = [];
    let currentRow: LayoutItem[] = [];
    
    // Sort fields: Name and ID first, then alphabetical
    const sortedFields = [...fields].sort((a, b) => {
        if (a.apiName === 'Name') return -1;
        if (b.apiName === 'Name') return 1;
        if (a.apiName === 'Id') return -1;
        if (b.apiName === 'Id') return 1;
        return a.label.localeCompare(b.label);
    });

    sortedFields.forEach((field, index) => {
        const item: LayoutItem = {
            label: field.label,
            layoutComponents: [{ type: 'Field', value: field.apiName }]
        };
        currentRow.push(item);
        
        // Create 2-column layout
        if (currentRow.length === 2 || index === sortedFields.length - 1) {
            layoutRows.push({ layoutItems: currentRow });
            currentRow = [];
        }
    });

    return {
        id: 'system-default',
        name: 'System Default Layout',
        detailLayoutSections: [{
            heading: `${objectType} Details`,
            useHeading: true,
            layoutRows: layoutRows,
            columns: 2
        }]
    };
};

const RecordDetailModal: React.FC<RecordDetailModalProps> = ({ recordId, objectType, orgMetadata, onClose }) => {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [relatedData, setRelatedData] = useState<Record<string, any[]> | null>(null);
  const [layouts, setLayouts] = useState<PageLayout[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string>('');
  
  const [loading, setLoading] = useState(true);
  const [layoutLoading, setLayoutLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<Tab>('details');
  
  // AI Summary
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    const loadRecordAndMetadata = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch Object Details (for relationships and fallback layout fields)
        const objDetails = await fetchObjectDetails(orgMetadata.instanceUrl, orgMetadata.accessToken, objectType);
        
        // 2. Fetch Record with Related Lists
        const recordResult = await fetchRecordWithRelated(
            orgMetadata.instanceUrl, 
            orgMetadata.accessToken, 
            objectType, 
            recordId,
            objDetails.childRelationships
        );
        
        const { relatedData, ...mainRecord } = recordResult;
        setData(mainRecord);
        setRelatedData(relatedData || {});
        
        // Stop blocking loading state so user sees data immediately
        setLoading(false);

        // 3. Fetch Page Layouts (Non-blocking UI update)
        setLayoutLoading(true);
        try {
            const fetchedLayouts = await fetchObjectLayouts(orgMetadata.instanceUrl, orgMetadata.accessToken, objectType);
            
            if (fetchedLayouts && fetchedLayouts.length > 0) {
                setLayouts(fetchedLayouts);
                setSelectedLayoutId(fetchedLayouts[0].id);
            } else {
                // Generate Fallback
                console.log("No layouts returned, generating default.");
                const defaultLayout = createDefaultLayout(objectType, objDetails.fields);
                setLayouts([defaultLayout]);
                setSelectedLayoutId(defaultLayout.id);
            }
        } catch (layoutError) {
            console.warn("Layout fetch failed, using default", layoutError);
            const defaultLayout = createDefaultLayout(objectType, objDetails.fields);
            setLayouts([defaultLayout]);
            setSelectedLayoutId(defaultLayout.id);
        } finally {
            setLayoutLoading(false);
        }
        
      } catch (err: any) {
        setError(err.message || "Failed to load record details");
        setLoading(false);
        setLayoutLoading(false);
      }
    };

    if (recordId && objectType) {
      loadRecordAndMetadata();
    }
  }, [recordId, objectType, orgMetadata]);

  useEffect(() => {
      if (activeTab === 'summary' && !summary && data) {
          const fetchSummary = async () => {
              setLoadingSummary(true);
              const text = await summarizeRecord(objectType, data, relatedData);
              setSummary(text);
              setLoadingSummary(false);
          };
          fetchSummary();
      }
  }, [activeTab, summary, data, relatedData, objectType]);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getActiveLayout = () => {
      return layouts.find(l => l.id === selectedLayoutId);
  };

  const renderLayoutField = (item: LayoutItem) => {
      if (!item.layoutComponents || item.layoutComponents.length === 0) {
          return <div className="h-8"></div>; // Empty placeholder
      }

      // We only care about Fields for now, ignore Custom Links/Controls
      const fieldComponent = item.layoutComponents.find(c => c.type === 'Field');
      
      if (!fieldComponent) {
          return null; // Or render label if it's a separator
      }

      const fieldName = fieldComponent.value;
      const value = data ? data[fieldName] : null;
      const displayValue = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
      
      return (
          <div className="flex flex-col py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 px-2 rounded transition-colors group">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                    {item.label}
                    <button 
                        onClick={() => handleCopy(displayValue, fieldName)}
                        className="text-slate-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Copy value"
                    >
                        {copiedField === fieldName ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                </span>
                <span className="text-sm text-slate-800 break-words font-mono bg-slate-50/50 p-1 rounded border border-slate-50 min-h-[28px]">
                    {value === null || value === undefined ? <span className="text-slate-300 italic">--</span> : displayValue}
                </span>
          </div>
      );
  };

  const renderLayout = () => {
      const layout = getActiveLayout();
      if (!layout) {
           return (
               <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <Layout size={32} className="mb-2 opacity-50" />
                    <p>No layout definition available.</p>
               </div>
           );
      }

      return (
          <div className="space-y-6">
              {layout.detailLayoutSections.map((section: LayoutSection, sIdx: number) => (
                  <div key={sIdx} className="bg-white rounded-lg">
                      {section.useHeading && (
                          <h3 className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-2 rounded-t-lg border-b border-slate-200 mb-2">
                              {section.heading}
                          </h3>
                      )}
                      <div className="px-2 pb-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                          {section.layoutRows.map((row, rIdx) => (
                              <React.Fragment key={rIdx}>
                                  {row.layoutItems.map((item, iIdx) => (
                                      <div key={iIdx}>
                                          {item.placeholder ? <div className="h-full"></div> : renderLayoutField(item)}
                                      </div>
                                  ))}
                              </React.Fragment>
                          ))}
                      </div>
                  </div>
              ))}
          </div>
      );
  };

  const renderRelatedLists = () => {
      if (!relatedData || Object.keys(relatedData).length === 0) {
           return (
            <div className="p-8 text-center text-slate-500">
                <List size={32} className="mx-auto mb-2 opacity-30" />
                <p>No related records found or accessible.</p>
            </div>
           );
      }

      return Object.entries(relatedData).map(([relName, records]: [string, any[]]) => {
           if (records.length === 0) return null;
           
           return (
               <div key={relName} className="mb-6 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                   <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 font-semibold text-sm text-slate-700 flex justify-between">
                       <span>{relName}</span>
                       <span className="text-xs bg-slate-200 px-2 py-0.5 rounded-full">{records.length}</span>
                   </div>
                   <div className="overflow-x-auto">
                       <table className="min-w-full divide-y divide-slate-200">
                           <thead className="bg-slate-50">
                               <tr>
                                   {Object.keys(records[0]).filter(k => k !== 'attributes').map(k => (
                                       <th key={k} className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{k}</th>
                                   ))}
                               </tr>
                           </thead>
                           <tbody className="bg-white divide-y divide-slate-100">
                               {records.map((rec: any, idx: number) => (
                                   <tr key={idx} className="hover:bg-blue-50/30">
                                       {Object.keys(rec).filter(k => k !== 'attributes').map((k, colIdx) => (
                                           <td key={colIdx} className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">
                                               {typeof rec[k] === 'object' ? '...' : rec[k]}
                                           </td>
                                       ))}
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>
               </div>
           );
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Database size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{objectType} Detail</h2>
              <p className="text-xs text-slate-500 font-mono flex items-center gap-1">
                  {recordId}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
              {/* Dynamic Layout Switcher */}
              <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 hover:border-blue-300 transition-colors">
                  <Layout size={16} className="text-slate-400 ml-2" />
                  {layoutLoading ? (
                       <span className="text-xs text-slate-400 px-2 py-1.5 flex items-center">
                          <Loader2 size={10} className="animate-spin mr-1" /> Loading Layouts...
                       </span>
                  ) : layouts.length > 0 ? (
                      <select 
                        value={selectedLayoutId}
                        onChange={(e) => setSelectedLayoutId(e.target.value)}
                        className="bg-transparent border-none text-xs font-medium text-slate-700 focus:ring-0 cursor-pointer pr-8 py-1.5"
                      >
                          {layouts.map(l => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                      </select>
                  ) : (
                      <span className="text-xs text-slate-400 px-2 py-1.5">No Layouts</span>
                  )}
              </div>

              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 bg-slate-50 flex space-x-6">
            <button 
                onClick={() => setActiveTab('details')}
                className={`pb-3 pt-3 text-sm font-medium border-b-2 flex items-center space-x-2 transition-colors ${activeTab === 'details' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <Layout size={16} /> <span>Details</span>
            </button>
            <button 
                onClick={() => setActiveTab('related')}
                className={`pb-3 pt-3 text-sm font-medium border-b-2 flex items-center space-x-2 transition-colors ${activeTab === 'related' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <List size={16} /> <span>Related</span>
            </button>
            <button 
                onClick={() => setActiveTab('summary')}
                className={`pb-3 pt-3 text-sm font-medium border-b-2 flex items-center space-x-2 transition-colors ${activeTab === 'summary' ? 'border-purple-500 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <Brain size={16} /> <span>AI Summary</span>
                {activeTab !== 'summary' && !summary && <span className="bg-purple-100 text-purple-600 text-[10px] px-1.5 rounded-full">New</span>}
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Loader2 className="animate-spin mb-3 text-blue-500" size={32} />
              <p>Fetching record data...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-48 text-red-500 bg-red-50 rounded-lg border border-red-100">
              <AlertCircle size={32} className="mb-2" />
              <p>{error}</p>
            </div>
          ) : (
            <>
                {activeTab === 'details' && (
                    <div className="animate-fadeIn">
                        {renderLayout()}
                    </div>
                )}
                {activeTab === 'related' && (
                    <div className="animate-fadeIn">
                        {renderRelatedLists()}
                        <p className="text-center text-xs text-slate-400 mt-4">
                            Note: Displaying first 5 records of first 10 active relationships due to API constraints.
                        </p>
                    </div>
                )}
                {activeTab === 'summary' && (
                     <div className="animate-fadeIn">
                         {loadingSummary ? (
                             <div className="flex flex-col items-center justify-center h-48 text-purple-500">
                                 <Brain size={32} className="animate-pulse mb-3" />
                                 <p className="text-sm font-medium">Analyzing record business context...</p>
                             </div>
                         ) : (
                             <div className="prose prose-sm prose-purple max-w-none">
                                 <div className="bg-purple-50 p-6 rounded-xl border border-purple-100">
                                     <h3 className="text-purple-900 flex items-center gap-2 mt-0">
                                         <Brain size={20} />
                                         Executive Summary
                                     </h3>
                                     <div className="markdown-content" dangerouslySetInnerHTML={{ 
                                         // Simple markdown render replacement for demo
                                         __html: summary?.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                                        .replace(/# (.*?)\n/g, '<h4 class="text-lg font-bold mt-4 mb-2">$1</h4>')
                                                        .replace(/\n/g, '<br/>') || '' 
                                     }} />
                                 </div>
                             </div>
                         )}
                     </div>
                )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
            <div className="text-xs text-slate-500 flex items-center">
                <span className="bg-white border border-slate-200 px-2 py-0.5 rounded mr-2 text-slate-600 font-medium">{getActiveLayout()?.name || 'Standard'}</span>
                Layout Active
            </div>
            <div className="flex space-x-3">
                 <button 
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
                >
                    Close
                </button>
                <a 
                    href={`${orgMetadata.instanceUrl}/${recordId}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center transition-colors"
                >
                    Open in Salesforce <ExternalLink size={14} className="ml-2" />
                </a>
            </div>
        </div>
      </div>
    </div>
  );
};

export default RecordDetailModal;
