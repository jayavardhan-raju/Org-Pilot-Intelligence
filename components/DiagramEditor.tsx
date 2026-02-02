
import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, { 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  MarkerType,
  Node,
  Edge,
  Handle,
  Position,
  Panel,
  Connection,
  addEdge,
  NodeProps,
  ReactFlowProvider
} from 'reactflow';
import dagre from 'dagre';
import { OrgMetadata, Resource, ResourceAssignment, UPNNodeData } from '../types';
import { generateDiagramFromRequirement } from '../services/geminiService';
import { fetchOrgProcessDefinitions, fetchApprovalProcessSteps, ProcessDefinitionOption } from '../services/salesforceService';
import { 
  Sparkles, Play, ZoomIn, Share2, AlertCircle, Save, Layers, 
  Users, GitBranch, Shield, Activity, ChevronRight, ChevronDown, 
  Layout, Monitor, Building, ArrowRight, User, ListFilter, RotateCcw
} from 'lucide-react';
import { HelpTooltip } from './HelpTooltip';

// --- MOCK RESOURCES ---
const AVAILABLE_RESOURCES: Resource[] = [
    { id: 'res-sales-mgr', name: 'Sales Manager', type: 'human', initials: 'SM', color: '#3b82f6' },
    { id: 'res-sales-rep', name: 'Sales Rep', type: 'human', initials: 'SR', color: '#6366f1' },
    { id: 'res-finance', name: 'Finance Team', type: 'human', initials: 'FN', color: '#10b981' },
    { id: 'sys-sf', name: 'Salesforce', type: 'system', initials: 'SF', color: '#0ea5e9' },
    { id: 'sys-erp', name: 'Oracle ERP', type: 'system', initials: 'OR', color: '#f59e0b' },
    { id: 'fac-warehouse', name: 'Warehouse', type: 'facility', initials: 'WH', color: '#64748b' },
];

// --- CUSTOM NODE: UPN ACTIVITY ---
const UPNActivityNode = ({ data, selected }: NodeProps<UPNNodeData>) => {
    // Determine border color based on Impact Level
    let borderColor = selected ? 'border-blue-500' : 'border-slate-300';
    let borderWidth = selected ? 'border-2' : 'border';
    
    if (data.impactLevel === 'critical') {
        borderColor = 'border-red-500';
        borderWidth = 'border-4';
    } else if (data.impactLevel === 'high') {
        borderColor = 'border-orange-500';
        borderWidth = 'border-4';
    }

    return (
        <div className={`w-[200px] bg-white rounded-lg shadow-sm ${borderWidth} ${borderColor} flex flex-col overflow-hidden transition-all group hover:shadow-md`}>
            {/* Top Fold for Drilldown */}
            {data.drilldownId && (
                <div className="absolute top-0 left-0 w-0 h-0 border-t-[12px] border-l-[12px] border-t-slate-800 border-l-transparent transform rotate-180 z-20 cursor-pointer" title="Has Drilldown"></div>
            )}
            
            <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-3 !h-1 !rounded-sm" />
            
            {/* Header: Resource Icons */}
            <div className="bg-slate-50 px-2 py-1 flex items-center justify-end space-x-1 border-b border-slate-100 h-7">
                {data.resources?.map((assign, i) => {
                    const res = AVAILABLE_RESOURCES.find(r => r.id === assign.resourceId);
                    if (!res) return null;
                    return (
                        <div 
                            key={i} 
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-white font-bold"
                            style={{ backgroundColor: res.color }}
                            title={`${res.name} (R:${assign.rasci.r ? 'Y': 'N'})`}
                        >
                            {res.initials}
                        </div>
                    );
                })}
            </div>

            {/* Body: What happens? */}
            <div className="p-3 flex-1 flex flex-col items-center justify-center min-h-[60px] relative">
                <span className="text-[10px] text-slate-400 uppercase font-bold absolute top-1 left-2">Activity</span>
                <p className="text-xs font-semibold text-slate-800 text-center leading-tight mt-2">{data.label}</p>
                <div className="absolute top-0 right-0 w-3 h-3 group-hover:block hidden">
                     <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></div>
                </div>
            </div>

            {/* Footer: Outcome (Why?) */}
            {data.outcome && (
                <div className="bg-green-50 px-2 py-1.5 border-t border-green-100 text-center">
                    <p className="text-[9px] text-green-800 font-medium truncate" title={data.outcome}>
                        → {data.outcome}
                    </p>
                </div>
            )}

            <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-3 !h-1 !rounded-sm" />
        </div>
    );
};

const nodeTypes = {
  'upn-activity': UPNActivityNode,
};

// --- LAYOUT HELPER ---
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: 200, height: 100 });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - 100,
                y: nodeWithPosition.y - 50,
            },
        };
    });

    return { nodes: layoutedNodes, edges };
};

interface DiagramEditorProps {
    metadata: OrgMetadata;
}

const DiagramEditor: React.FC<DiagramEditorProps> = ({ metadata }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNode, setSelectedNode] = useState<Node<UPNNodeData> | null>(null);
    const [impactMode, setImpactMode] = useState(false);
    
    // AI / Process Generation State
    const [generationMode, setGenerationMode] = useState<'custom' | 'existing'>('existing');
    const [customPrompt, setCustomPrompt] = useState('');
    const [selectedProcessId, setSelectedProcessId] = useState<string>('');
    const [availableProcesses, setAvailableProcesses] = useState<ProcessDefinitionOption[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [loadingProcesses, setLoadingProcesses] = useState(false);

    // Initial Example Diagram
    useEffect(() => {
        // Load processes
        setLoadingProcesses(true);
        fetchOrgProcessDefinitions(metadata.instanceUrl, metadata.accessToken)
            .then(data => {
                setAvailableProcesses(data);
                if (data.length > 0) setSelectedProcessId(data[0].id);
            })
            .catch(err => console.error("Failed to load processes", err))
            .finally(() => setLoadingProcesses(false));

        // Set default diagram
        const initialNodes: Node<UPNNodeData>[] = [
            { id: '1', type: 'upn-activity', position: { x: 250, y: 0 }, data: { label: 'New Lead Created', outcome: 'Lead Captured', resources: [{ resourceId: 'sys-sf', rasci: { r: true, a: false, s: false, c: false, i: false } }] } },
            { id: '2', type: 'upn-activity', position: { x: 250, y: 150 }, data: { label: 'Qualify Lead', outcome: 'Decision Made', resources: [{ resourceId: 'res-sales-rep', rasci: { r: true, a: true, s: false, c: false, i: false } }] } },
            { id: '3', type: 'upn-activity', position: { x: 100, y: 300 }, data: { label: 'Convert to Opportunity', outcome: 'Opp Created', resources: [{ resourceId: 'res-sales-rep', rasci: { r: true, a: true, s: false, c: false, i: false } }] } },
            { id: '4', type: 'upn-activity', position: { x: 400, y: 300 }, data: { label: 'Mark as Unqualified', outcome: 'Lead Closed', resources: [{ resourceId: 'res-sales-rep', rasci: { r: true, a: true, s: false, c: false, i: false } }] } },
        ];
        const initialEdges: Edge[] = [
            { id: 'e1-2', source: '1', target: '2', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
            { id: 'e2-3', source: '2', target: '3', label: 'Qualified', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
            { id: 'e2-4', source: '2', target: '4', label: 'Not Interest', type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
        ];
        const layouted = getLayoutedElements(initialNodes, initialEdges);
        setNodes(layouted.nodes);
        setEdges(layouted.edges);
    }, [metadata]);

    const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }, eds)), [setEdges]);

    const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
        if (impactMode) {
            runImpactAnalysis(node.id);
        }
    }, [impactMode]);

    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
        if (impactMode) {
            clearImpactAnalysis();
        }
    }, [impactMode]);

    // --- IMPACT ANALYSIS LOGIC ---
    const runImpactAnalysis = (startNodeId: string) => {
        // Simple BFS to find downstream nodes
        const downstreamIds = new Set<string>();
        const queue = [startNodeId];
        
        while (queue.length > 0) {
            const current = queue.shift()!;
            downstreamIds.add(current);
            const children = edges.filter(e => e.source === current).map(e => e.target);
            children.forEach(c => {
                if (!downstreamIds.has(c)) queue.push(c);
            });
        }

        setNodes((nds) => nds.map((n) => {
            if (n.id === startNodeId) return { ...n, data: { ...n.data, impactLevel: 'critical' }, style: { opacity: 1 } };
            if (downstreamIds.has(n.id)) return { ...n, data: { ...n.data, impactLevel: 'high' }, style: { opacity: 1 } };
            return { ...n, data: { ...n.data, impactLevel: 'none' }, style: { opacity: 0.3 } };
        }));
    };

    const clearImpactAnalysis = () => {
        setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, impactLevel: 'none' }, style: { opacity: 1 } })));
    };

    const toggleImpactMode = () => {
        const newMode = !impactMode;
        setImpactMode(newMode);
        if (!newMode) clearImpactAnalysis();
    };

    // --- GENERATION HANDLER ---
    const handleGenerate = async () => {
        setIsGenerating(true);
        let finalPrompt = "";

        try {
            if (generationMode === 'custom') {
                if (!customPrompt.trim()) return;
                finalPrompt = customPrompt;
            } else {
                // Existing Process Mode
                const selectedProc = availableProcesses.find(p => p.id === selectedProcessId);
                if (!selectedProc) return;

                let stepsList: string[] = selectedProc.steps || [];
                
                // If Approval Process, fetch real steps dynamically
                if (selectedProc.type === 'Approval') {
                     try {
                        const fetchedSteps = await fetchApprovalProcessSteps(metadata.instanceUrl, metadata.accessToken, selectedProc.id);
                        if (fetchedSteps.length > 0) stepsList = fetchedSteps;
                     } catch (e) { console.warn("Could not fetch approval steps", e); }
                }

                // Construct Prompt based on Real Data
                finalPrompt = `Generate a UPN diagram for the ${selectedProc.type} Process named "${selectedProc.label}" on Object "${selectedProc.objectType}".`;
                
                if (stepsList.length > 0) {
                    finalPrompt += ` It contains the following defined steps in order: ${stepsList.join(' -> ')}. Ensure the nodes in the diagram strictly follow this sequence.`;
                } else if (selectedProc.description) {
                    finalPrompt += ` Description: ${selectedProc.description}`;
                }
            }

            const rawData = await generateDiagramFromRequirement(finalPrompt, metadata);
            
            if (rawData && rawData.nodes) {
                // Transform AI nodes to UPN nodes
                const newNodes: Node[] = rawData.nodes.map((n: any) => ({
                    id: n.id,
                    type: 'upn-activity',
                    position: { x: 0, y: 0 },
                    data: {
                        label: n.data?.label || n.label || 'Activity',
                        outcome: n.data?.outcome || 'Done',
                        resources: n.data?.resources || []
                    }
                }));
                const newEdges: Edge[] = rawData.edges ? rawData.edges.map((e: any) => ({
                     id: e.id || `e-${e.source}-${e.target}`,
                     source: e.source,
                     target: e.target,
                     type: 'smoothstep',
                     markerEnd: { type: MarkerType.ArrowClosed }
                })) : [];

                const layouted = getLayoutedElements(newNodes, newEdges);
                setNodes(layouted.nodes);
                setEdges(layouted.edges);
            }
        } catch (e) {
            console.error("Generation Failed", e);
            alert("Failed to generate diagram.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex h-full gap-0 animate-fadeIn relative">
            {/* LEFT: Shape Library (Static for now) */}
            <div className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-4 gap-4 z-10 shadow-sm">
                 <HelpTooltip text="Drag shapes to canvas (feature coming soon)" />
                 <div className="p-2 bg-slate-100 rounded hover:bg-slate-200 cursor-grab active:cursor-grabbing" title="Activity Box">
                     <div className="w-6 h-4 border border-slate-400 bg-white rounded-sm"></div>
                 </div>
                 <div className="p-2 bg-slate-100 rounded hover:bg-slate-200 cursor-grab" title="Decision">
                     <div className="w-4 h-4 border border-slate-400 bg-white transform rotate-45"></div>
                 </div>
                 <div className="p-2 bg-slate-100 rounded hover:bg-slate-200 cursor-grab" title="Note">
                     <div className="w-5 h-5 bg-yellow-100 border border-yellow-300"></div>
                 </div>
                 <div className="flex-1"></div>
                 <button className="p-2 text-slate-400 hover:text-blue-500"><Save size={20} /></button>
            </div>

            {/* CENTER: Canvas */}
            <div className="flex-1 h-full relative bg-slate-50">
                <ReactFlowProvider>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        fitView
                    >
                        <Background color="#cbd5e1" gap={20} />
                        <Controls className="bg-white shadow-md border border-slate-200 p-1" />
                        
                        {/* TOP TOOLBAR */}
                        <Panel position="top-center" className="bg-white p-1.5 rounded-lg shadow-md border border-slate-200 flex items-center space-x-3 mt-4">
                             {/* Generation Controls */}
                             <div className="flex items-center space-x-2 bg-slate-50 p-1 rounded-md border border-slate-100">
                                <div className="flex space-x-1 border-r border-slate-200 pr-2 mr-1">
                                    <button 
                                        onClick={() => setGenerationMode('existing')}
                                        className={`px-2 py-1 text-xs font-medium rounded transition-colors ${generationMode === 'existing' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                                        title="Select Existing Process"
                                    >
                                        <ListFilter size={14} />
                                    </button>
                                    <button 
                                        onClick={() => setGenerationMode('custom')}
                                        className={`px-2 py-1 text-xs font-medium rounded transition-colors ${generationMode === 'custom' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                                        title="Custom Requirement"
                                    >
                                        <Sparkles size={14} />
                                    </button>
                                </div>

                                {generationMode === 'custom' ? (
                                    <input 
                                        className="bg-transparent border-none text-xs w-64 focus:ring-0" 
                                        placeholder="Describe process (e.g. 'Order to Cash')..."
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                                    />
                                ) : (
                                    <div className="w-64">
                                        {loadingProcesses ? (
                                            <span className="text-xs text-slate-400 px-2">Loading processes...</span>
                                        ) : availableProcesses.length === 0 ? (
                                            <span className="text-xs text-slate-400 px-2 italic">No active processes found</span>
                                        ) : (
                                            <select 
                                                value={selectedProcessId}
                                                onChange={(e) => setSelectedProcessId(e.target.value)}
                                                className="w-full bg-transparent border-none text-xs focus:ring-0 py-0 pl-0 cursor-pointer"
                                            >
                                                {availableProcesses.map(p => (
                                                    <option key={p.id} value={p.id}>{p.label} ({p.type})</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                )}
                                
                                <button 
                                    onClick={handleGenerate}
                                    disabled={isGenerating || (generationMode === 'custom' && !customPrompt)}
                                    className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-md hover:bg-purple-700 transition-colors flex items-center"
                                >
                                    {isGenerating ? 'Generating...' : 'Generate'}
                                </button>
                             </div>

                             <div className="h-6 w-px bg-slate-200"></div>
                             
                             <button 
                                onClick={toggleImpactMode}
                                className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${impactMode ? 'bg-red-50 text-red-600 border border-red-200' : 'text-slate-600 hover:bg-slate-50'}`}
                             >
                                <Activity size={14} />
                                <span>Impact Analysis</span>
                             </button>
                        </Panel>
                    </ReactFlow>
                </ReactFlowProvider>
            </div>

            {/* RIGHT: Properties Panel */}
            <div className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-xl z-10">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-bold text-slate-800">
                        {selectedNode ? 'Activity Details' : 'Diagram Properties'}
                    </h3>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                    {selectedNode ? (
                        <div className="space-y-6">
                            {/* Basics */}
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">Label</label>
                                <input 
                                    type="text" 
                                    className="w-full mt-1 p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={selectedNode.data.label}
                                    readOnly // Read-only for this demo
                                />
                            </div>
                            
                            {/* Outcome */}
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">Outcome (Why)</label>
                                <textarea 
                                    className="w-full mt-1 p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
                                    value={selectedNode.data.outcome}
                                    readOnly
                                />
                            </div>

                            {/* Resources (RASCI) */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Resources (RASCI)</label>
                                    <button className="text-xs text-blue-600 hover:underline">+ Add</button>
                                </div>
                                <div className="space-y-2">
                                    {selectedNode.data.resources?.map((res: ResourceAssignment, idx: number) => {
                                        const resourceDef = AVAILABLE_RESOURCES.find(r => r.id === res.resourceId);
                                        return (
                                            <div key={idx} className="bg-slate-50 p-2 rounded border border-slate-200">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center space-x-2">
                                                        {resourceDef?.type === 'human' && <User size={12} />}
                                                        {resourceDef?.type === 'system' && <Monitor size={12} />}
                                                        <span className="text-sm font-medium">{resourceDef?.name}</span>
                                                    </div>
                                                </div>
                                                <div className="flex space-x-1 mt-1">
                                                    {['R','A','S','C','I'].map(role => (
                                                        <span key={role} className={`text-[10px] w-5 h-5 flex items-center justify-center rounded border ${
                                                            (res.rasci as any)[role.toLowerCase()] 
                                                            ? 'bg-blue-100 text-blue-700 border-blue-300 font-bold' 
                                                            : 'bg-white text-slate-300 border-slate-200'
                                                        }`}>
                                                            {role}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {(!selectedNode.data.resources || selectedNode.data.resources.length === 0) && (
                                        <p className="text-xs text-slate-400 italic">No resources assigned.</p>
                                    )}
                                </div>
                            </div>
                            
                            {/* Drilldown */}
                            <div className="pt-4 border-t border-slate-100">
                                <button className="w-full py-2 bg-white border border-slate-300 rounded text-sm text-slate-700 font-medium hover:bg-slate-50 flex items-center justify-center">
                                    <Layers size={14} className="mr-2" />
                                    Manage Drilldowns
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-slate-400 mt-10">
                            <Layout size={40} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Select an activity to view details, assign resources, or configure drill-downs.</p>
                            
                            {impactMode && (
                                <div className="mt-8 p-4 bg-red-50 text-red-700 rounded-lg border border-red-100 text-left">
                                    <h4 className="font-bold text-sm flex items-center mb-1"><Activity size={14} className="mr-2"/> Impact Mode Active</h4>
                                    <p className="text-xs">Click a node to visualize downstream dependencies. Critical paths will be highlighted in red.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DiagramEditor;
