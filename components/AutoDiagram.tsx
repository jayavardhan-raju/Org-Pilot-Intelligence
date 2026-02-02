import React, { useState, useEffect, useCallback } from 'react';
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
import { OrgMetadata, ProcessDiagram } from '../types';
import { generateDiagramFromRequirement } from '../services/geminiService';
import { fetchOrgBusinessProcesses } from '../services/salesforceService';
import { Sparkles, Play, Share2, ZoomIn, AlertCircle, Palette, Workflow, ArrowRight, Loader2, Check } from 'lucide-react';
import { HelpTooltip } from './HelpTooltip';

interface AutoDiagramProps {
  metadata: OrgMetadata;
}

type DiagramStyle = 'corporate' | 'modern' | 'blueprint';

const nodeWidth = 180;
const nodeHeight = 50;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
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
      targetPosition: 'top',
      sourcePosition: 'bottom',
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

const AutoDiagram: React.FC<AutoDiagramProps> = ({ metadata }) => {
  const [requirement, setRequirement] = useState('');
  const [diagramData, setDiagramData] = useState<ProcessDiagram | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStyle, setCurrentStyle] = useState<DiagramStyle>('corporate');
  
  // Existing Business Processes State
  const [existingProcesses, setExistingProcesses] = useState<ProcessDiagram[]>([]);
  const [loadingProcesses, setLoadingProcesses] = useState(false);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Fetch Existing Processes on Mount
  useEffect(() => {
    const loadProcesses = async () => {
        setLoadingProcesses(true);
        try {
            const processes = await fetchOrgBusinessProcesses(metadata.instanceUrl, metadata.accessToken);
            setExistingProcesses(processes);
            
            // Auto-load the first process if available
            if (processes.length > 0) {
                setDiagramData(processes[0]);
                setRequirement(`Diagram for ${processes[0].title}: ${processes[0].description}`);
            }
        } catch (e) {
            console.error("Failed to load business processes", e);
        } finally {
            setLoadingProcesses(false);
        }
    };
    loadProcesses();
  }, [metadata]);

  const getNodeStyle = (type: string, style: DiagramStyle) => {
    const baseStyle: React.CSSProperties = { 
        padding: '10px 20px', 
        borderRadius: '8px', 
        fontSize: '12px',
        fontWeight: 500,
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    };

    if (style === 'modern') {
        const modernBase = {
            ...baseStyle,
            background: '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #334155',
            boxShadow: '0 0 10px rgba(0,0,0,0.3)',
            fontFamily: "'Inter', sans-serif",
        };
        switch(type) {
            case 'start':
            case 'end': return { ...modernBase, background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', border: 'none', color: 'white', borderRadius: '24px' };
            case 'decision': return { ...modernBase, borderColor: '#ec4899', color: '#fbcfe8', borderStyle: 'solid' };
            default: return { ...modernBase, borderColor: '#06b6d4', color: '#cffafe' };
        }
    } else if (style === 'blueprint') {
        const blueprintBase = {
            ...baseStyle,
            background: 'transparent',
            color: 'white',
            border: '2px solid white',
            fontFamily: "'Patrick Hand', cursive",
            fontSize: '16px',
            boxShadow: 'none',
        };
        switch(type) {
            case 'start':
            case 'end': return { ...blueprintBase, borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px', borderWidth: '2px' };
            case 'decision': return { ...blueprintBase, transform: 'rotate(-1deg)', borderStyle: 'dashed' };
            default: return { ...blueprintBase, borderRadius: '2px' };
        }
    } else {
        // Corporate
        const corpBase = {
            ...baseStyle,
            background: '#white',
            border: '1px solid #e2e8f0',
            fontFamily: "'Inter', sans-serif",
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
        };
        switch (type) {
            case 'start':
            case 'end': return { ...corpBase, background: '#1e293b', color: 'white', border: 'none', borderRadius: '24px' };
            case 'decision': return { ...corpBase, background: '#fffbeb', borderColor: '#fcd34d', color: '#92400e', borderStyle: 'dashed', borderWidth: '2px' };
            default: return { ...corpBase, background: '#eff6ff', borderColor: '#bfdbfe', color: '#1e40af' };
        }
    }
  };

  const getEdgeOptions = (style: DiagramStyle) => {
      if (style === 'modern') {
          return {
              type: 'default',
              animated: true,
              style: { stroke: '#94a3b8', strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' }
          };
      } else if (style === 'blueprint') {
          return {
              type: 'straight',
              animated: false,
              style: { stroke: 'white', strokeWidth: 2, strokeDasharray: '5,5' },
              markerEnd: { type: MarkerType.ArrowClosed, color: 'white' }
          };
      } else {
          return {
              type: 'smoothstep',
              animated: true,
              style: { stroke: '#64748b' },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' }
          };
      }
  };

  const regenerateGraph = useCallback(() => {
      if (!diagramData) return;
      
      const edgeOpts = getEdgeOptions(currentStyle);

      const flowNodes: Node[] = diagramData.nodes.map(n => ({
          id: n.id,
          data: { label: n.label },
          position: { x: 0, y: 0 },
          type: n.type === 'start' ? 'input' : n.type === 'end' ? 'output' : 'default',
          style: getNodeStyle(n.type, currentStyle)
      }));

      const flowEdges: Edge[] = diagramData.edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          ...edgeOpts
      }));

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          flowNodes,
          flowEdges
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
  }, [diagramData, currentStyle, setNodes, setEdges]);

  // Effect to update graph when style or data changes
  useEffect(() => {
      regenerateGraph();
  }, [regenerateGraph]);


  const handleGenerate = async () => {
    if (!requirement.trim()) return;
    setIsGenerating(true);
    setError(null);
    setDiagramData(null);
    
    try {
      const result = await generateDiagramFromRequirement(requirement, metadata);
      if (result && result.nodes.length > 0) {
        setDiagramData(result); 
        // regenerateGraph will trigger via useEffect
      } else {
        setError("The AI could not generate a valid diagram. Please try rephrasing your requirement.");
      }
    } catch (err) {
      setError("An error occurred while communicating with the AI service.");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleLoadProcess = (process: ProcessDiagram) => {
      setDiagramData(process);
      setRequirement(`Diagram for ${process.title}: ${process.description}`);
  };

  const getBgProps = () => {
      if (currentStyle === 'modern') return { color: '#334155', variant: BackgroundVariant.Dots, className: 'bg-slate-900' };
      if (currentStyle === 'blueprint') return { color: '#60a5fa', variant: BackgroundVariant.Lines, className: 'bg-blue-900' };
      return { color: '#cbd5e1', variant: BackgroundVariant.Dots, className: 'bg-slate-50' };
  };

  const bgProps = getBgProps();

  return (
    <div className="flex flex-col gap-6 pb-12 animate-fadeIn">
      
      {/* Existing Processes Carousel */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-2 mb-3 px-1">
             <Workflow className="text-blue-600" size={20} />
             <h3 className="font-bold text-slate-800">Existing Business Processes</h3>
             <HelpTooltip text="Standard Sales, Service, and Lead processes fetched directly from your Org." className="ml-2" />
             {loadingProcesses && <Loader2 size={16} className="animate-spin text-slate-400" />}
        </div>
        
        <div className="flex space-x-4 overflow-x-auto pb-2 scrollbar-hide snap-x">
             {!loadingProcesses && existingProcesses.length === 0 && (
                 <div className="text-sm text-slate-400 italic px-2">No standard business processes found.</div>
             )}
             
             {existingProcesses.map((proc) => {
                 const isActive = diagramData?.id === proc.id;
                 return (
                 <div 
                    key={proc.id}
                    onClick={() => handleLoadProcess(proc)}
                    className={`flex-shrink-0 w-64 bg-slate-50 border rounded-lg p-3 cursor-pointer hover:shadow-md transition-all snap-start group relative
                        ${isActive ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/20' : 'border-slate-200 hover:border-blue-300'}
                    `}
                 >
                    {isActive && (
                        <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-0.5">
                            <Check size={10} />
                        </div>
                    )}
                    <div className="flex justify-between items-start mb-2">
                        <span className={`font-semibold text-sm truncate pr-4 ${isActive ? 'text-blue-700' : 'text-slate-800'}`} title={proc.title}>{proc.title}</span>
                        {!isActive && (
                            <div className="p-1 bg-white rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2">
                                <ZoomIn size={12} className="text-blue-500" />
                            </div>
                        )}
                    </div>
                    
                    {/* CSS Mini Map Preview */}
                    <div className={`h-24 rounded border p-2 overflow-hidden relative ${isActive ? 'bg-white border-blue-100' : 'bg-white border-slate-100'}`}>
                         <div className="absolute top-2 left-2 right-2 bottom-2 flex flex-col items-center justify-start space-y-1">
                             {/* Draw first 3 nodes as boxes */}
                             {proc.nodes.slice(0, 3).filter(n => n.type === 'process').map((node, i) => (
                                 <React.Fragment key={i}>
                                     <div className={`w-full h-4 rounded border text-[8px] flex items-center justify-center px-1 truncate
                                        ${isActive ? 'bg-blue-100 border-blue-200 text-blue-800' : 'bg-slate-100 border-slate-200 text-slate-600'}
                                     `}>
                                         {node.label}
                                     </div>
                                     {i < 2 && <div className="h-2 w-[1px] bg-slate-300"></div>}
                                 </React.Fragment>
                             ))}
                             {proc.nodes.filter(n => n.type === 'process').length > 3 && (
                                 <div className="text-[8px] text-slate-400">...</div>
                             )}
                         </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                         <span className="text-[10px] text-slate-500">{proc.nodes.length} Steps</span>
                         <span className={`text-[10px] font-medium group-hover:underline ${isActive ? 'text-blue-700' : 'text-blue-600'}`}>
                             {isActive ? 'Viewing' : 'Load Diagram'}
                         </span>
                    </div>
                 </div>
             )})}
        </div>
      </div>

      {/* Generation Input */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center mb-2">
            <label className="block text-sm font-medium text-slate-700">
            Or describe a new business process to map with AI
            </label>
            <HelpTooltip text="Enter text requirements to generate a visual flow diagram." className="ml-2" />
        </div>
        <div className="flex gap-4 items-start">
          <textarea
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            placeholder="e.g. When a new high-value Opportunity is created, check if the Account exists. If not create one, otherwise notify the sales manager."
            className="flex-1 min-h-[80px] p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
          />
          <div className="flex flex-col gap-2">
            <button
                onClick={handleGenerate}
                disabled={isGenerating || !requirement}
                className={`px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium flex items-center justify-center min-w-[140px] transition-all
                ${isGenerating ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-lg hover:scale-105'}
                `}
            >
                {isGenerating ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                <>
                    <Sparkles className="mr-2" size={18} />
                    <span>Generate</span>
                </>
                )}
            </button>
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                {(['corporate', 'modern', 'blueprint'] as DiagramStyle[]).map((style) => (
                    <button
                        key={style}
                        onClick={() => setCurrentStyle(style)}
                        className={`flex-1 px-3 py-1 text-xs font-medium rounded-md capitalize transition-all ${
                            currentStyle === style 
                            ? 'bg-white text-blue-700 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                        title={`${style} style`}
                    >
                        {style}
                    </button>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Diagram Area - Fixed Height for Scrollability */}
      <div className={`h-[600px] shrink-0 rounded-xl border border-slate-200 overflow-hidden relative flex flex-col shadow-inner transition-colors duration-500 ${bgProps.className}`}>
        <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm border border-slate-200 p-2 rounded-lg shadow-sm flex items-center space-x-3">
             <div className="flex flex-col">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Preview Mode</span>
                 <span className="text-xs font-semibold text-slate-700 capitalize">{currentStyle} Diagram</span>
             </div>
        </div>

        <div className="absolute top-4 right-4 z-10 flex space-x-2">
            <button className="p-2 bg-white/90 backdrop-blur-sm text-slate-500 hover:text-slate-700 hover:bg-white rounded-lg shadow-sm border border-slate-200 transition-colors">
              <ZoomIn size={18} />
            </button>
            <button className="p-2 bg-white/90 backdrop-blur-sm text-slate-500 hover:text-slate-700 hover:bg-white rounded-lg shadow-sm border border-slate-200 transition-colors">
              <Share2 size={18} />
            </button>
        </div>
        
        <div className="flex-1 h-full w-full relative">
          {error ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 z-20">
                <AlertCircle size={48} className="mb-4 opacity-50" />
                <p className="text-center font-medium max-w-md">{error}</p>
             </div>
          ) : !diagramData ? (
            <div className={`absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none ${currentStyle === 'modern' ? 'text-slate-500' : currentStyle === 'blueprint' ? 'text-blue-300' : 'text-slate-400'}`}>
               <div className={`w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center mb-4 ${currentStyle === 'modern' ? 'border-slate-700' : currentStyle === 'blueprint' ? 'border-blue-400' : 'border-slate-300'}`}>
                 <Play size={24} className="ml-1 opacity-50" />
               </div>
               <p>Select a process from the carousel or generate a new one.</p>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              fitView
              attributionPosition="bottom-right"
            >
              <Background color={bgProps.color} variant={bgProps.variant} gap={24} />
              <Controls className="bg-white shadow-md border border-slate-200 rounded-lg p-1" />
            </ReactFlow>
          )}
        </div>
      </div>
    </div>
  );
};

export default AutoDiagram;