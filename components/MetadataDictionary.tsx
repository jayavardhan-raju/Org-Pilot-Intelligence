import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, { 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  MarkerType, 
  Node, 
  Edge,
  BackgroundVariant
} from 'reactflow';
import dagre from 'dagre';
import { OrgMetadata, SObject, SField } from '../types';
import { fetchObjectDetails } from '../services/salesforceService';
import { HelpTooltip } from './HelpTooltip';
import { 
  Search, Table, Filter, ArrowRight, Database, Loader2, 
  Info, Shield, GitBranch, Users, FileText, BarChart3, 
  AlertTriangle, CheckCircle, MoreHorizontal, ExternalLink,
  X, ZoomIn, Share2, Palette, ChevronRight, ChevronDown, 
  Folder, Box, Layers, Code, PlayCircle, Settings
} from 'lucide-react';

interface DictionaryProps {
  data: OrgMetadata;
}

type TabType = 'overview' | 'fields' | 'dependencies' | 'access' | 'documentation' | 'assessment';

// --- Graph Layout Helper ---
const nodeWidth = 220;
const nodeHeight = 60;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: 'left',
      sourcePosition: 'right',
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// Mock Intelligence Data
const getMockIntelligence = (field: SField) => {
    // Deterministic mock based on name length
    const seed = field.apiName.length;
    const population = Math.min(100, Math.max(10, seed * 7));
    const impact = population > 80 ? 'High' : population > 40 ? 'Medium' : 'Low';
    return { population, impact };
};

const MetadataDictionary: React.FC<DictionaryProps> = ({ data }) => {
  const [selectedObject, setSelectedObject] = useState<SObject | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [cachedDetails, setCachedDetails] = useState<Record<string, SObject>>({});
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  // Tree State
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Standard Objects', 'Custom Objects']));
  
  // Dependency Explorer State
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Data Categorization for Tree (Module 2)
  const standardObjects = data.objects.filter(o => !o.isCustom);
  const customObjects = data.objects.filter(o => o.isCustom);
  
  // Filter Logic
  const filterObjects = (list: SObject[]) => 
    list.filter(obj => 
        obj.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
        obj.apiName.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const filteredStandard = filterObjects(standardObjects);
  const filteredCustom = filterObjects(customObjects);

  const toggleCategory = (category: string) => {
      const next = new Set(expandedCategories);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      setExpandedCategories(next);
  };

  const handleSelectObject = async (obj: SObject) => {
    setSelectedObject(obj);
    setActiveTab('overview');
    
    if (cachedDetails[obj.apiName]) {
        setSelectedObject(cachedDetails[obj.apiName]);
        return;
    }

    setLoadingDetails(true);
    try {
        const details = await fetchObjectDetails(data.instanceUrl, data.accessToken, obj.apiName);
        const enrichedObject = { ...obj, ...details };
        setCachedDetails(prev => ({ ...prev, [obj.apiName]: enrichedObject }));
        setSelectedObject(enrichedObject);
    } catch (err) {
        console.error("Failed to fetch object details", err);
    } finally {
        setLoadingDetails(false);
    }
  };

  // Generate Graph Data (Module 6)
  const generateDependencyGraph = useCallback(() => {
    if (!selectedObject || !selectedObject.fields) return;

    const initialNodes: Node[] = [];
    const initialEdges: Edge[] = [];

    // Center Node: Current Object
    initialNodes.push({
      id: selectedObject.apiName,
      type: 'input',
      data: { label: selectedObject.label },
      position: { x: 0, y: 0 },
      style: { 
        background: '#eff6ff', 
        color: '#1e3a8a', 
        border: '2px solid #3b82f6', 
        borderRadius: '8px',
        fontWeight: 'bold',
        width: 200,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }
    });

    // Outgoing relationships
    const referenceFields = selectedObject.fields
        .filter(f => f.type === 'reference' && f.referenceTo && f.referenceTo.length > 0)
        .slice(0, 15);

    referenceFields.forEach((field) => {
        const targetObjName = field.referenceTo![0];
        
        if (!initialNodes.find(n => n.id === targetObjName)) {
             initialNodes.push({
                id: targetObjName,
                data: { label: targetObjName },
                position: { x: 0, y: 0 },
                style: { 
                    background: '#ffffff', 
                    color: '#475569', 
                    border: '1px solid #cbd5e1', 
                    borderRadius: '8px',
                    width: 180
                }
            });
        }

        initialEdges.push({
            id: `e-${field.apiName}`,
            source: selectedObject.apiName,
            target: targetObjName,
            label: field.label,
            type: 'smoothstep',
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: '#94a3b8' }
        });
    });

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

  }, [selectedObject, setNodes, setEdges]);

  useEffect(() => {
    if (isExplorerOpen) {
        generateDependencyGraph();
    }
  }, [isExplorerOpen, generateDependencyGraph]);


  const renderTabContent = () => {
    if (!selectedObject) return null;
    if (loadingDetails) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Loader2 className="animate-spin mb-2" size={32} />
                <p>Analyzing metadata structure...</p>
            </div>
        );
    }

    switch (activeTab) {
        case 'overview':
            return (
                <div className="space-y-6 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                            <div className="flex justify-between items-start">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Record Count</h4>
                                <HelpTooltip text="Total number of records currently in this object." />
                            </div>
                            <div className="text-2xl font-bold text-slate-800">{selectedObject.recordCount?.toLocaleString() ?? 'N/A'}</div>
                         </div>
                         <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                            <div className="flex justify-between items-start">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Field Count</h4>
                                <HelpTooltip text="Total number of fields, including standard and custom." />
                            </div>
                            <div className="text-2xl font-bold text-slate-800">{selectedObject.fields?.length ?? 0}</div>
                         </div>
                         <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                            <div className="flex justify-between items-start">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Health Status</h4>
                                <HelpTooltip text="Automated assessment based on field utilization and complexity." />
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                <span className="text-sm font-medium text-slate-700">Healthy</span>
                            </div>
                         </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
                        <h3 className="text-lg font-medium text-slate-900 mb-4 flex items-center">
                             Object Definition
                             <HelpTooltip text="Core metadata properties from the Schema." className="ml-2" />
                        </h3>
                        <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                            <div className="flex justify-between border-b border-slate-100 py-2">
                                <span className="text-slate-500">API Name</span>
                                <span className="font-mono text-slate-700">{selectedObject.apiName}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 py-2">
                                <span className="text-slate-500">Label</span>
                                <span className="text-slate-700">{selectedObject.label}</span>
                            </div>
                             <div className="flex justify-between border-b border-slate-100 py-2">
                                <span className="text-slate-500">Type</span>
                                <span className="text-slate-700">{selectedObject.isCustom ? 'Custom Object' : 'Standard Object'}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 py-2">
                                <span className="text-slate-500">Key Prefix</span>
                                <span className="font-mono text-slate-700">{selectedObject.keyPrefix || 'N/A'}</span>
                            </div>
                            <div className="col-span-2 pt-2">
                                <span className="block text-slate-500 mb-1">Description</span>
                                <p className="text-slate-700 bg-slate-50 p-3 rounded-md italic border border-slate-100">
                                    {selectedObject.description || "No description available in Salesforce."}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        case 'fields':
            return (
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg animate-fadeIn bg-white">
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                         <h3 className="text-sm font-medium text-slate-700">Field Inventory ({selectedObject.fields?.length})</h3>
                         <div className="flex space-x-2">
                            <button className="text-xs bg-white border border-slate-300 px-3 py-1 rounded hover:bg-slate-50 text-slate-600">
                                Filter List
                            </button>
                            <button className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                                Export CSV
                            </button>
                         </div>
                    </div>
                    <table className="min-w-full divide-y divide-slate-300">
                        <thead className="bg-slate-50">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">Label</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">API Name</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Type</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                                    <div className="flex items-center">
                                        Population
                                        <HelpTooltip text="Percentage of records where this field has a value." className="ml-1" />
                                    </div>
                                </th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                                     <div className="flex items-center">
                                        Impact
                                        <HelpTooltip text="Calculated based on dependencies and usage." className="ml-1" />
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {selectedObject.fields?.map((field) => {
                                const { population, impact } = getMockIntelligence(field);
                                return (
                                    <tr key={field.apiName} className="hover:bg-slate-50 transition-colors">
                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">
                                            {field.label}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 font-mono">
                                            {field.apiName}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                                                {field.type}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                    <div className={`h-full ${population < 30 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${population}%` }}></div>
                                                </div>
                                                <span className="text-xs">{population}%</span>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium 
                                                ${impact === 'High' ? 'bg-red-50 text-red-700 border border-red-200' : 
                                                  impact === 'Medium' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
                                                  'bg-green-50 text-green-700 border border-green-200'}`}>
                                                {impact}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            );
        case 'dependencies':
            return (
                <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm animate-fadeIn h-[500px] flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-medium text-slate-900 flex items-center">
                                Dependency Graph
                                <HelpTooltip text="Visualizes relationships between this object and other metadata components." className="ml-2" />
                            </h3>
                            <p className="text-sm text-slate-500">Module 6: Impact Analysis & Dependencies</p>
                        </div>
                        <button 
                            onClick={() => setIsExplorerOpen(true)}
                            className="text-sm text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md font-medium transition-colors flex items-center shadow-sm"
                        >
                            <ZoomIn size={16} className="mr-2" /> Open Interactive Explorer
                        </button>
                    </div>
                    
                    {/* Inline Preview Placeholder */}
                    <div className="flex-1 border border-slate-200 rounded-lg bg-slate-50 relative overflow-hidden flex flex-col items-center justify-center">
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/graphy.png')] opacity-20"></div>
                         <GitBranch size={48} className="text-slate-300 mb-4" />
                         <p className="text-slate-600 font-medium z-10">Click 'Open Interactive Explorer' to visualize</p>
                         <p className="text-slate-500 text-sm z-10 mt-1">
                             {selectedObject.fields?.filter(f => f.type === 'reference').length} outgoing relationships detected.
                         </p>
                    </div>
                </div>
            );
        case 'access':
            return (
                <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm animate-fadeIn">
                     <div className="flex justify-between items-center mb-6">
                         <div>
                            <h3 className="text-lg font-medium text-slate-900 flex items-center">
                                User Access Analysis
                                <HelpTooltip text="Module 9: Audit user permissions for this object." className="ml-2" />
                            </h3>
                            <p className="text-sm text-slate-500">Users with 'View All' or 'Modify All' permissions.</p>
                         </div>
                         <button className="text-blue-600 text-sm font-medium hover:underline">Export Report</button>
                     </div>
                     
                     <div className="space-y-3">
                        {['System Administrator', 'Solution Manager', 'Custom Sales Profile', 'Support User'].map((profile, i) => (
                             <div key={i} className="flex items-center justify-between p-4 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
                                <div className="flex items-center">
                                    <div className="p-2 bg-slate-100 rounded-lg mr-3">
                                        <Shield size={18} className="text-slate-500" />
                                    </div>
                                    <div>
                                        <span className="text-sm font-bold text-slate-700 block">{profile}</span>
                                        <span className="text-xs text-slate-500">Assigned to 12 users</span>
                                    </div>
                                </div>
                                <div className="flex space-x-2">
                                    <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">Read</span>
                                    <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded">Create</span>
                                    <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded">Edit</span>
                                </div>
                             </div>
                        ))}
                     </div>
                </div>
            );
        case 'documentation':
             return (
                 <div className="space-y-6 animate-fadeIn">
                     <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-medium text-slate-900 flex items-center">
                                Notes & Documentation
                                <HelpTooltip text="Module 12: Rich text notes and compliance tagging." className="ml-2" />
                            </h3>
                            <button className="text-sm text-blue-600 font-medium hover:bg-blue-50 px-3 py-1 rounded">Edit</button>
                        </div>
                        <div className="prose prose-sm max-w-none text-slate-600 bg-slate-50 p-4 rounded border border-slate-200">
                            <p className="mb-2">This object is critical for the <strong>Q3 Sales Process</strong>.</p>
                            <p className="font-semibold mb-1">Primary Stakeholders:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>John Doe (Business Owner)</li>
                                <li>Jane Smith (Technical Lead)</li>
                            </ul>
                        </div>
                     </div>
                     
                     <div className="grid grid-cols-2 gap-6">
                        <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm">
                            <h3 className="text-lg font-medium text-slate-900 mb-4">Compliance</h3>
                            <div className="space-y-3">
                                <div className="flex items-center p-3 bg-slate-50 rounded border border-slate-200">
                                    <input type="checkbox" checked readOnly className="h-4 w-4 text-blue-600 rounded border-slate-300" />
                                    <span className="ml-2 text-sm text-slate-700">GDPR Sensitive</span>
                                </div>
                                <div className="flex items-center p-3 bg-slate-50 rounded border border-slate-200">
                                    <input type="checkbox" className="h-4 w-4 text-blue-600 rounded border-slate-300" />
                                    <span className="ml-2 text-sm text-slate-700">Contains PII</span>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm">
                             <h3 className="text-lg font-medium text-slate-900 mb-4">Optimization</h3>
                             <div className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200 mb-3">
                                 <span className="text-sm text-slate-600">Status</span>
                                 <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">Active</span>
                             </div>
                             <div className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
                                 <span className="text-sm text-slate-600">Review Due</span>
                                 <span className="text-sm text-slate-800">Dec 31, 2024</span>
                             </div>
                        </div>
                     </div>
                 </div>
             );
        default:
            return null;
    }
  };

  const TreeItem = ({ label, count, expanded, onClick, icon: Icon }: any) => (
      <button
        onClick={onClick}
        className="w-full flex items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
      >
          <div className="flex items-center">
              {expanded ? <ChevronDown size={14} className="mr-2 text-slate-400" /> : <ChevronRight size={14} className="mr-2 text-slate-400" />}
              <Icon size={16} className="mr-2 text-blue-500" />
              {label}
          </div>
          <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {count}
          </span>
      </button>
  );

  return (
    <>
        <div className="flex h-[calc(100vh-140px)] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Module 2: Hierarchical Metadata Tree */}
        <div className="w-80 border-r border-slate-200 flex flex-col flex-shrink-0 bg-slate-50">
            <div className="p-4 border-b border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-slate-800">Metadata Tree</h2>
                    <HelpTooltip text="Module 2: Navigate Org Metadata hierarchically." />
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search metadata..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {/* Standard Objects Tree Node */}
                <div>
                    <TreeItem 
                        label="Standard Objects" 
                        count={filteredStandard.length} 
                        expanded={expandedCategories.has('Standard Objects')} 
                        onClick={() => toggleCategory('Standard Objects')}
                        icon={Box}
                    />
                    {expandedCategories.has('Standard Objects') && (
                        <div className="ml-4 border-l border-slate-200 pl-2 space-y-0.5 mt-1">
                            {filteredStandard.map(obj => (
                                <button
                                    key={obj.apiName}
                                    onClick={() => handleSelectObject(obj)}
                                    className={`w-full text-left px-3 py-1.5 text-sm rounded-md flex items-center group transition-all ${
                                        selectedObject?.apiName === obj.apiName 
                                        ? 'bg-blue-50 text-blue-700 font-medium' 
                                        : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    <Database size={12} className={`mr-2 ${selectedObject?.apiName === obj.apiName ? 'text-blue-500' : 'text-slate-400'}`} />
                                    <span className="truncate">{obj.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Custom Objects Tree Node */}
                <div className="mt-1">
                    <TreeItem 
                        label="Custom Objects" 
                        count={filteredCustom.length} 
                        expanded={expandedCategories.has('Custom Objects')} 
                        onClick={() => toggleCategory('Custom Objects')}
                        icon={Layers}
                    />
                    {expandedCategories.has('Custom Objects') && (
                        <div className="ml-4 border-l border-slate-200 pl-2 space-y-0.5 mt-1">
                            {filteredCustom.map(obj => (
                                <button
                                    key={obj.apiName}
                                    onClick={() => handleSelectObject(obj)}
                                    className={`w-full text-left px-3 py-1.5 text-sm rounded-md flex items-center group transition-all ${
                                        selectedObject?.apiName === obj.apiName 
                                        ? 'bg-blue-50 text-blue-700 font-medium' 
                                        : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    <Database size={12} className={`mr-2 ${selectedObject?.apiName === obj.apiName ? 'text-blue-500' : 'text-slate-400'}`} />
                                    <span className="truncate">{obj.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Mocked Categories for Tree Completeness */}
                <div className="mt-1 opacity-60">
                    <TreeItem label="Apex Classes" count={0} expanded={false} onClick={() => {}} icon={Code} />
                </div>
                <div className="mt-1 opacity-60">
                    <TreeItem label="Flows" count={0} expanded={false} onClick={() => {}} icon={PlayCircle} />
                </div>
            </div>
        </div>

        {/* Main Content Detail */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {selectedObject ? (
            <>
                <div className="px-8 py-6 border-b border-slate-200 bg-white">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center space-x-3 mb-2">
                                <h2 className="text-2xl font-bold text-slate-900">{selectedObject.label}</h2>
                                {selectedObject.isCustom ? (
                                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium border border-indigo-200">Custom Object</span>
                                ) : (
                                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-medium border border-slate-200">Standard Object</span>
                                )}
                            </div>
                            <p className="text-sm text-slate-500 max-w-2xl font-mono">{selectedObject.apiName}</p>
                        </div>
                        <div className="flex space-x-2">
                            <button className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                                <MoreHorizontal size={20} />
                            </button>
                        </div>
                    </div>
                    
                    {/* Tabs Navigation */}
                    <div className="flex space-x-6 mt-8 -mb-6 border-b border-transparent">
                        {[
                            { id: 'overview', label: 'Overview', icon: Info },
                            { id: 'fields', label: 'Fields', icon: Table },
                            { id: 'dependencies', label: 'Dependencies', icon: GitBranch },
                            { id: 'access', label: 'Access', icon: Users },
                            { id: 'documentation', label: 'Documentation', icon: FileText }
                        ].map(tab => (
                            <button 
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`pb-4 text-sm font-medium transition-colors border-b-2 flex items-center space-x-2 ${
                                    activeTab === tab.id 
                                    ? 'border-blue-600 text-blue-600' 
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <tab.icon size={16} />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
                    {renderTabContent()}
                </div>
            </>
            ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/30">
                <div className="w-20 h-20 bg-white border border-slate-200 rounded-full flex items-center justify-center mb-6 shadow-sm">
                    <Database size={40} className="text-blue-500 opacity-80" />
                </div>
                <h3 className="text-xl font-bold text-slate-700">Select a Metadata Component</h3>
                <p className="text-sm mt-2 max-w-md text-center text-slate-500">
                    Use the tree on the left to navigate your Org's metadata hierarchy.
                    Select an object to view its fields, dependencies, and access controls.
                </p>
            </div>
            )}
        </div>
        </div>

        {/* Dependency Explorer Modal */}
        {isExplorerOpen && selectedObject && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="bg-white w-full h-full rounded-xl shadow-2xl flex flex-col overflow-hidden relative border border-slate-700">
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white shadow-sm z-10">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 flex items-center">
                                <GitBranch className="mr-2 text-blue-600" size={20}/> Dependency Explorer
                            </h2>
                            <p className="text-sm text-slate-500">Visualizing relationships for {selectedObject.label}</p>
                        </div>
                        <div className="flex items-center space-x-4">
                             <div className="text-xs text-slate-500 flex items-center bg-slate-100 px-3 py-1.5 rounded-full">
                                 <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span> Active
                                 <span className="w-2 h-2 bg-slate-400 rounded-full ml-3 mr-2"></span> Reference
                             </div>
                            <button onClick={() => setIsExplorerOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 bg-slate-50 relative">
                        {nodes.length > 0 ? (
                            <ReactFlow
                                nodes={nodes}
                                edges={edges}
                                onNodesChange={onNodesChange}
                                onEdgesChange={onEdgesChange}
                                fitView
                                attributionPosition="bottom-right"
                            >
                                <Background color="#cbd5e1" gap={16} variant={BackgroundVariant.Dots} />
                                <Controls className="bg-white shadow-md border border-slate-200 rounded-lg p-1 m-4" />
                            </ReactFlow>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                                <p>No direct reference dependencies found.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
    </>
  );
};

export default MetadataDictionary;