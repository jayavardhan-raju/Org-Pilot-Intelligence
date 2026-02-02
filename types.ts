
export interface UserCredentials {
  username: string;
  password?: string;
  securityToken?: string;
  clientId?: string;
  clientSecret?: string;
  orgType: 'Production' | 'Sandbox';
}

export interface SField {
  apiName: string;
  label: string;
  type: string;
  description?: string;
  isCustom: boolean;
  referenceTo?: string[];
}

export interface SChildRelationship {
  childSObject: string;
  field: string;
  relationshipName: string;
  cascadeDelete: boolean;
}

export interface SObject {
  apiName: string;
  label: string;
  isCustom: boolean;
  keyPrefix?: string;
  description?: string;
  // Fields are loaded lazily via describe calls
  fields?: SField[];
  childRelationships?: SChildRelationship[];
  // Record count requires explicit queries
  recordCount?: number;
}

export interface OrgMetadata {
  orgId: string;
  orgName: string;
  instanceUrl: string;
  accessToken: string;
  objects: SObject[];
}

export interface DiagramNode {
  id: string;
  label: string;
  type: 'start' | 'process' | 'decision' | 'end';
  x?: number;
  y?: number;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface ProcessDiagram {
  id: string;
  title: string;
  description: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

export interface SavedQuery {
  id: string;
  name: string;
  query: string;
  savedAt: number;
}

// Layout Definitions
export interface LayoutComponent {
  type: string;
  value: string; // API Name of the field
  details?: any;
}

export interface LayoutItem {
  label: string;
  layoutComponents: LayoutComponent[];
  placeholder?: boolean;
  required?: boolean;
}

export interface LayoutRow {
  layoutItems: LayoutItem[];
}

export interface LayoutSection {
  heading: string;
  useHeading: boolean;
  layoutRows: LayoutRow[];
  columns?: number;
  detailHeading?: boolean;
}

export interface PageLayout {
  id: string;
  name: string;
  detailLayoutSections: LayoutSection[];
  relatedLists?: any[]; 
}

// --- DIAGRAMMING SPECIFIC TYPES ---

export interface Resource {
  id: string;
  name: string;
  type: 'human' | 'system' | 'facility';
  initials: string;
  icon?: string;
  color?: string;
}

export interface ResourceAssignment {
  resourceId: string;
  rasci: {
    r: boolean; // Responsible
    a: boolean; // Accountable
    s: boolean; // Supportive
    c: boolean; // Consulted
    i: boolean; // Informed
  };
}

export interface UPNNodeData {
  label: string; // The "What"
  description?: string;
  outcome?: string; // The "Why"
  input?: string; // The "When"
  output?: string;
  resources: ResourceAssignment[]; // The "Who"
  drilldownId?: string;
  isDrilldown?: boolean;
  impactLevel?: 'none' | 'low' | 'medium' | 'critical'; // For Impact Analysis
}
