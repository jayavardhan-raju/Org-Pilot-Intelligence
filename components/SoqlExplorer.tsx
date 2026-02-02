
import React, { useState, useEffect, useRef } from 'react';
import { executeSoql, fetchObjectDetails } from '../services/salesforceService';
import { OrgMetadata, SavedQuery, SField } from '../types';
import { Play, Search, AlertCircle, Loader2, Download, History, Save, Trash2, Folder, Keyboard, FileText, Database } from 'lucide-react';
import RecordDetailModal from './RecordDetailModal';
import { HelpTooltip } from './HelpTooltip';

interface SoqlExplorerProps {
  metadata: OrgMetadata;
}

interface QueryResult {
  totalSize: number;
  records: any[];
}

type EditorTab = 'editor' | 'saved';

const SoqlExplorer: React.FC<SoqlExplorerProps> = ({ metadata }) => {
  const [activeTab, setActiveTab] = useState<EditorTab>('editor');
  const [query, setQuery] = useState('SELECT Id, Name, Type, CreatedDate FROM Account ORDER BY CreatedDate DESC LIMIT 10');
  const [results, setResults] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Saved Queries State
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [saveName, setSaveName] = useState('');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  
  // Autocomplete State
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cachedObjectFields, setCachedObjectFields] = useState<Record<string, SField[]>>({});

  // Record Detail Modal State
  const [selectedRecord, setSelectedRecord] = useState<{id: string, type: string} | null>(null);

  // Load saved queries on mount
  useEffect(() => {
    const saved = localStorage.getItem('orgPilot_savedQueries');
    if (saved) {
        try {
            setSavedQueries(JSON.parse(saved));
        } catch (e) {
            console.error("Failed to parse saved queries", e);
        }
    }
  }, []);

  const saveQueriesToStorage = (queries: SavedQuery[]) => {
      setSavedQueries(queries);
      localStorage.setItem('orgPilot_savedQueries', JSON.stringify(queries));
  };

  const handleExecute = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);
    setResults(null);
    
    try {
      const data = await executeSoql(metadata.instanceUrl, metadata.accessToken, query);
      setResults(data);
    } catch (err: any) {
      setError(err.message || "Query execution failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuery = () => {
      if (!saveName.trim()) return;
      
      const newQuery: SavedQuery = {
          id: Date.now().toString(),
          name: saveName,
          query: query,
          savedAt: Date.now()
      };
      
      saveQueriesToStorage([newQuery, ...savedQueries]);
      setSaveName('');
      setIsSaveModalOpen(false);
  };

  const handleDeleteQuery = (id: string) => {
      const filtered = savedQueries.filter(q => q.id !== id);
      saveQueriesToStorage(filtered);
  };

  const loadSavedQuery = (savedQuery: string) => {
      setQuery(savedQuery);
      setActiveTab('editor');
  };

  // Autocomplete Logic
  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl + Space trigger
      if (e.ctrlKey && e.code === 'Space') {
          e.preventDefault();
          const target = e.target as HTMLTextAreaElement;
          const position = target.selectionStart;

          // Find the object name in "FROM ObjectName"
          // We search the entire query to find the FROM clause
          const fromMatch = query.match(/FROM\s+(\w+)/i);

          if (fromMatch && fromMatch[1]) {
              const objName = fromMatch[1];
              let fields = cachedObjectFields[objName];
              
              if (!fields) {
                  setLoading(true); // temporary loading indicator
                  try {
                       const details = await fetchObjectDetails(metadata.instanceUrl, metadata.accessToken, objName);
                       fields = details.fields;
                       setCachedObjectFields(prev => ({...prev, [objName]: fields}));
                  } catch (err) {
                      console.error("Could not fetch fields for autocomplete", err);
                      setError(`Could not fetch fields for ${objName}`);
                      setLoading(false);
                      return; 
                  }
                  setLoading(false);
              }
              
              if (fields && fields.length > 0) {
                 // Insert ALL fields
                 const allFields = fields.map(f => f.apiName).join(', ');
                 
                 // Insert at cursor
                 const newQuery = query.substring(0, position) + allFields + query.substring(position);
                 setQuery(newQuery);
              }
          } else {
              alert("Please specify a 'FROM ObjectName' clause before using autocomplete.");
          }
      }
  };

  const handleRowClick = (record: any) => {
    const type = record.attributes?.type;
    const id = record.Id;

    if (id && type) {
        setSelectedRecord({ id, type });
    } else if (id) {
        // Fallback: try to guess from query
        const fromMatch = query.match(/FROM\s+(\w+)/i);
        if (fromMatch && fromMatch[1]) {
            setSelectedRecord({ id, type: fromMatch[1] });
        } else {
            alert("Cannot determine object type for detail view.");
        }
    }
  };

  const downloadCsv = () => {
    if (!results || !results.records.length) return;
    
    const records = results.records;
    const headers = Object.keys(records[0]).filter(k => k !== 'attributes');
    
    const csvContent = [
      headers.join(','),
      ...records.map(row => headers.map(fieldName => {
        const val = row[fieldName];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val).replace(/,/g, ';'); 
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `query_results_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-6 animate-fadeIn w-full">
        
      {/* Top Section: Editor & Saved Queries */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative w-full flex-shrink-0">
         {/* Tabs */}
         <div className="flex border-b border-slate-200">
             <button 
                onClick={() => setActiveTab('editor')}
                className={`px-6 py-3 text-sm font-medium flex items-center space-x-2 transition-colors ${activeTab === 'editor' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
             >
                 <FileText size={16} />
                 <span>Query Editor</span>
             </button>
             <button 
                onClick={() => setActiveTab('saved')}
                className={`px-6 py-3 text-sm font-medium flex items-center space-x-2 transition-colors ${activeTab === 'saved' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
             >
                 <Folder size={16} />
                 <span>Saved Queries ({savedQueries.length})</span>
             </button>
         </div>

         {/* Tab Content */}
         <div className="p-0">
             {activeTab === 'editor' && (
                 <div className="p-4 flex flex-col gap-4">
                    <div className="flex justify-between items-center px-2">
                        <h3 className="text-sm font-bold text-slate-700 flex items-center">
                            SOQL Query
                            <HelpTooltip text="Execute direct SOQL queries. Press Ctrl+Space to auto-insert ALL available fields for the object." className="ml-2" />
                        </h3>
                        <div className="flex space-x-2">
                            <span className="text-xs text-slate-400 flex items-center mr-4 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                <Keyboard size={12} className="mr-1" /> Ctrl+Space: Insert All Fields
                            </span>
                            <button 
                                onClick={() => setIsSaveModalOpen(true)}
                                className="flex items-center space-x-1 px-3 py-1.5 text-xs bg-white border border-slate-300 text-slate-600 rounded hover:bg-slate-50 transition-colors"
                            >
                                <Save size={14} />
                                <span>Save</span>
                            </button>
                            <button
                                onClick={handleExecute}
                                disabled={loading || !query}
                                className={`flex items-center space-x-2 px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-medium shadow-sm transition-all
                                    ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700 hover:shadow'}
                                `}
                            >
                                {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                                <span>Execute</span>
                            </button>
                        </div>
                    </div>
                    <textarea
                        ref={textareaRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full h-32 p-4 font-mono text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none leading-relaxed"
                        placeholder="SELECT Id, Name FROM Account..."
                        spellCheck={false}
                    />
                 </div>
             )}

             {activeTab === 'saved' && (
                 <div className="h-48 overflow-y-auto p-2">
                     {savedQueries.length === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-slate-400">
                             <Folder size={24} className="mb-2 opacity-50" />
                             <p className="text-sm">No saved queries found.</p>
                         </div>
                     ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-2">
                             {savedQueries.map(sq => (
                                 <div key={sq.id} className="group border border-slate-200 rounded-lg p-3 hover:border-blue-300 hover:shadow-sm bg-slate-50 transition-all flex flex-col justify-between h-24">
                                     <div>
                                         <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-medium text-slate-700 text-sm truncate pr-2" title={sq.name}>{sq.name}</h4>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteQuery(sq.id); }}
                                                className="text-slate-300 hover:text-red-500"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                         </div>
                                         <p className="text-xs text-slate-500 line-clamp-2 font-mono bg-white p-1 rounded border border-slate-100">{sq.query}</p>
                                     </div>
                                     <button 
                                        onClick={() => loadSavedQuery(sq.query)}
                                        className="mt-2 w-full py-1 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-100 font-medium"
                                     >
                                         Load Query
                                     </button>
                                 </div>
                             ))}
                         </div>
                     )}
                 </div>
             )}
         </div>
      </div>

      {/* Results Section - Full Height & Scrollable */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0 relative">
            {error ? (
                <div className="flex flex-col items-center justify-center h-full text-red-500 p-8">
                    <div className="bg-red-50 p-4 rounded-full mb-4">
                        <AlertCircle size={32} />
                    </div>
                    <h4 className="text-lg font-bold text-slate-800 mb-2">Query Failed</h4>
                    <p className="text-center text-slate-600 max-w-lg font-mono text-sm bg-slate-50 p-4 rounded border border-slate-200">
                        {error}
                    </p>
                </div>
            ) : !results ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <Search size={48} className="mb-4 opacity-20" />
                    <p className="text-lg font-medium text-slate-500">Ready to explore</p>
                    <p className="text-sm">Enter a SOQL query above to view records.</p>
                </div>
            ) : (
                <>
                    <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center flex-shrink-0">
                        <div className="flex items-center space-x-4">
                            <span className="text-sm font-semibold text-slate-700">
                                {results.totalSize} Records found
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                                {results.records.length} displayed
                            </span>
                        </div>
                        <button 
                            onClick={downloadCsv}
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200"
                            title="Download CSV"
                        >
                            <Download size={18} />
                        </button>
                    </div>
                    
                    {/* SCROLLABLE CONTAINER */}
                    <div className="flex-1 overflow-auto w-full h-full relative">
                        <table className="min-w-full divide-y divide-slate-200 border-collapse">
                            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    {results.records.length > 0 && Object.keys(results.records[0])
                                        .filter(k => k !== 'attributes')
                                        .map(key => (
                                        <th key={key} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50 whitespace-nowrap">
                                            {key}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {results.records.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-blue-50/50 transition-colors group">
                                        {Object.keys(row)
                                            .filter(k => k !== 'attributes')
                                            .map((key, colIdx) => {
                                                const val = row[key];
                                                // Interactive first column (Usually Id)
                                                if (key.toLowerCase() === 'id') {
                                                    return (
                                                        <td 
                                                            key={key} 
                                                            className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 cursor-pointer hover:underline"
                                                            onClick={() => handleRowClick(row)}
                                                        >
                                                            {val}
                                                        </td>
                                                    );
                                                }
                                                return (
                                                    <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 max-w-xs truncate" title={String(val)}>
                                                        {val === null ? <span className="text-slate-300 italic">null</span> : 
                                                        typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                                    </td>
                                                );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>

      {/* Save Query Modal */}
      {isSaveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
                  <h3 className="text-lg font-bold mb-4">Save Query</h3>
                  <input 
                      type="text" 
                      placeholder="Query Name" 
                      value={saveName}
                      onChange={e => setSaveName(e.target.value)}
                      className="w-full border p-2 rounded mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setIsSaveModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
                      <button onClick={handleSaveQuery} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
                  </div>
              </div>
          </div>
      )}

      {/* Record Detail Modal */}
      {selectedRecord && (
        <RecordDetailModal
            recordId={selectedRecord.id}
            objectType={selectedRecord.type}
            orgMetadata={metadata}
            onClose={() => setSelectedRecord(null)}
        />
      )}
    </div>
  );
};

export default SoqlExplorer;
