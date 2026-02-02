
import { UserCredentials, OrgMetadata, SObject, SField, ProcessDiagram, DiagramNode, DiagramEdge, SChildRelationship, PageLayout } from '../types';

// Switching to corsproxy.io to avoid the "Proxy Access Denied" demo page requirement of cors-anywhere
const PROXY_URL = 'https://corsproxy.io/?';

export interface ProcessDefinitionOption {
    id: string;
    label: string;
    type: 'Standard' | 'Flow' | 'Approval';
    objectType: string;
    description: string;
    steps?: string[]; // For pre-fetched steps like stages
}

export const authenticate = async (creds: UserCredentials): Promise<OrgMetadata> => {
  const loginHost = creds.orgType === 'Sandbox' 
    ? 'test.salesforce.com' 
    : 'login.salesforce.com';

  const soapEndpoint = `https://${loginHost}/services/Soap/u/60.0`;
  const proxiedEndpoint = PROXY_URL + encodeURIComponent(soapEndpoint);

  const soapBody = `<?xml version="1.0" encoding="utf-8" ?>
    <env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
      <env:Body>
        <n1:login xmlns:n1="urn:partner.soap.sforce.com">
          <n1:username>${creds.username}</n1:username>
          <n1:password>${creds.password}${creds.securityToken || ''}</n1:password>
        </n1:login>
      </env:Body>
    </env:Envelope>`;

  try {
    const response = await fetch(proxiedEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '""',
      },
      body: soapBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(errorText, "text/xml");
      const faultString = xmlDoc.querySelector("faultstring")?.textContent;
      throw new Error(`Login failed: ${faultString || response.statusText}`);
    }

    const responseText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(responseText, "text/xml");

    const sessionId = xmlDoc.querySelector("sessionId")?.textContent;
    const serverUrlRaw = xmlDoc.querySelector("serverUrl")?.textContent;
    const organizationId = xmlDoc.querySelector("organizationId")?.textContent; 

    if (!sessionId || !serverUrlRaw) {
      throw new Error("Invalid response from Salesforce: Missing session ID or Server URL");
    }

    const urlParts = new URL(serverUrlRaw);
    const instanceUrl = `${urlParts.protocol}//${urlParts.host}`;

    const objects = await fetchGlobalDescribe(instanceUrl, sessionId);
    
    let orgName = 'Salesforce Org';
    try {
       const orgQuery = await fetchQuery(instanceUrl, sessionId, "SELECT Name FROM Organization");
       if (orgQuery.records && orgQuery.records.length > 0) {
          orgName = orgQuery.records[0].Name;
       }
    } catch (e) {
       console.warn("Could not fetch Org Name", e);
    }

    return {
      orgId: organizationId || 'Unknown',
      orgName: orgName,
      instanceUrl: instanceUrl,
      accessToken: sessionId,
      objects: objects
    };
  } catch (error: any) {
    console.error("Auth Error", error);
    throw new Error(error.message || "Authentication failed.");
  }
};

const fetchQuery = async (instanceUrl: string, accessToken: string, q: string) => {
    const targetUrl = `${instanceUrl}/services/data/v60.0/query?q=${encodeURIComponent(q)}`;
    const url = `${PROXY_URL}${encodeURIComponent(targetUrl)}`;
    
    const res = await fetch(url, {
        headers: { 
            'Authorization': `Bearer ${accessToken}`
        }
    });
    if (!res.ok) {
        let errorMessage = "Query Failed";
        try {
            const err = await res.json();
            if (Array.isArray(err) && err[0]?.message) errorMessage = err[0].message;
        } catch(e) {
             errorMessage = await res.text();
        }
        throw new Error(errorMessage);
    }
    return await res.json();
}

export const executeSoql = async (instanceUrl: string, accessToken: string, query: string) => {
    return await fetchQuery(instanceUrl, accessToken, query);
};

export const fetchRecordById = async (instanceUrl: string, accessToken: string, objectName: string, recordId: string) => {
    const targetUrl = `${instanceUrl}/services/data/v60.0/sobjects/${objectName}/${recordId}`;
    const url = `${PROXY_URL}${encodeURIComponent(targetUrl)}`;

    const res = await fetch(url, {
        headers: { 
            'Authorization': `Bearer ${accessToken}`
        }
    });
    if (!res.ok) throw new Error("Failed to fetch record details");
    return await res.json();
};

export const fetchRecordWithRelated = async (instanceUrl: string, accessToken: string, objectName: string, recordId: string, childRels: SChildRelationship[]) => {
    // Step A: Fetch base record data (using REST retrieve)
    const baseRecord = await fetchRecordById(instanceUrl, accessToken, objectName, recordId);
    
    // Step B: Fetch Related Lists via Query
    const relationshipsToQuery = childRels
        .filter(r => r.relationshipName) 
        .slice(0, 10);
        
    if (relationshipsToQuery.length === 0) {
        return { ...baseRecord, relatedData: {} };
    }

    const subqueries = relationshipsToQuery.map(r => 
        `(SELECT Id, Name, CreatedDate FROM ${r.relationshipName} LIMIT 5)`
    ).join(', ');

    const query = `SELECT Id, ${subqueries} FROM ${objectName} WHERE Id = '${recordId}'`;
    
    try {
        const queryResult = await fetchQuery(instanceUrl, accessToken, query);
        if (queryResult.records && queryResult.records.length > 0) {
            const resultRow = queryResult.records[0];
            const relatedData: Record<string, any[]> = {};
            
            relationshipsToQuery.forEach(r => {
                if (resultRow[r.relationshipName]) {
                    relatedData[r.relationshipName] = resultRow[r.relationshipName].records || [];
                }
            });
            
            return { ...baseRecord, relatedData };
        }
    } catch (e) {
        console.warn("Failed to fetch related lists via SOQL", e);
    }
    
    return { ...baseRecord, relatedData: {} };
};

export const fetchObjectLayouts = async (instanceUrl: string, accessToken: string, objectName: string): Promise<PageLayout[]> => {
    const targetUrl = `${instanceUrl}/services/data/v60.0/sobjects/${objectName}/describe/layouts`;
    const url = `${PROXY_URL}${encodeURIComponent(targetUrl)}`;
    
    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!res.ok) {
            console.warn("Failed to fetch layouts via REST API");
            return [];
        }
        
        const data = await res.json();
        return Array.isArray(data.layouts) ? data.layouts : [];
    } catch (e) {
        console.warn("Error fetching object layouts", e);
        return [];
    }
};

const fetchGlobalDescribe = async (instanceUrl: string, accessToken: string): Promise<SObject[]> => {
  const targetUrl = `${instanceUrl}/services/data/v60.0/sobjects`;
  const url = `${PROXY_URL}${encodeURIComponent(targetUrl)}`;
  
  const response = await fetch(url, {
    headers: { 
        'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
      let errorMessage = `Failed to fetch global metadata (${response.status})`;
      try {
          const errData = await response.json();
          if (Array.isArray(errData) && errData[0]?.message) {
              errorMessage = errData[0].message;
          } else if (typeof errData === 'string') {
               errorMessage = errData;
          }
      } catch (e) {
          const text = await response.text();
          if (text) errorMessage += `: ${text.substring(0, 150)}`;
      }
      throw new Error(errorMessage);
  }
  
  const data = await response.json();
  
  return data.sobjects.map((obj: any) => ({
    apiName: obj.name,
    label: obj.label,
    isCustom: obj.custom,
    keyPrefix: obj.keyPrefix,
    recordCount: 0, 
    fields: [] 
  }));
};

export const fetchObjectDetails = async (instanceUrl: string, accessToken: string, objectName: string): Promise<{fields: SField[], childRelationships: SChildRelationship[], recordCount: number}> => {
    const targetDescribeUrl = `${instanceUrl}/services/data/v60.0/sobjects/${objectName}/describe`;
    const describeUrl = `${PROXY_URL}${encodeURIComponent(targetDescribeUrl)}`;
    
    const describeRes = await fetch(describeUrl, {
        headers: { 
            'Authorization': `Bearer ${accessToken}`
        }
    });
    
    if (!describeRes.ok) throw new Error(`Failed to describe ${objectName}`);
    const describeData = await describeRes.json();
    
    const fields: SField[] = describeData.fields.map((f: any) => ({
        apiName: f.name,
        label: f.label,
        type: f.type,
        description: f.description || '',
        isCustom: f.custom,
        referenceTo: f.referenceTo 
    }));

    const childRelationships: SChildRelationship[] = (describeData.childRelationships || []).map((cr: any) => ({
        childSObject: cr.childSObject,
        field: cr.field,
        relationshipName: cr.relationshipName,
        cascadeDelete: cr.cascadeDelete
    }));

    let recordCount = 0;
    try {
        const queryRes = await fetchQuery(instanceUrl, accessToken, `SELECT count() FROM ${objectName}`);
        recordCount = queryRes.totalSize;
    } catch (e) {
        console.warn("Could not fetch record count", e);
    }

    return { fields, childRelationships, recordCount };
};

export const fetchOrgBusinessProcesses = async (instanceUrl: string, accessToken: string): Promise<ProcessDiagram[]> => {
    const diagrams: ProcessDiagram[] = [];
    // Kept for backward compatibility if referenced elsewhere, but new logic is in fetchOrgProcessDefinitions
    return diagrams;
};

// --- NEW PROCESS DEFINITION FETCHING ---

export const fetchOrgProcessDefinitions = async (instanceUrl: string, accessToken: string): Promise<ProcessDefinitionOption[]> => {
    const results: ProcessDefinitionOption[] = [];
    
    // 1. Standard: Opportunity
    try {
        const oppStages = await fetchQuery(instanceUrl, accessToken, "SELECT MasterLabel FROM OpportunityStage ORDER BY SortOrder ASC");
        if(oppStages.records && oppStages.records.length > 0) {
            results.push({
                id: 'std-opp',
                label: 'Opportunity Sales Process',
                type: 'Standard',
                objectType: 'Opportunity',
                description: 'Standard lifecycle based on Opportunity Stages.',
                steps: oppStages.records.map((r:any) => r.MasterLabel)
            });
        }
    } catch(e) { console.warn("Error fetching Opportunity Stages", e); }

    // 2. Standard: Lead
    try {
        const leadStatus = await fetchQuery(instanceUrl, accessToken, "SELECT MasterLabel FROM LeadStatus ORDER BY SortOrder ASC");
        if(leadStatus.records && leadStatus.records.length > 0) {
            results.push({
                id: 'std-lead',
                label: 'Lead Qualification',
                type: 'Standard',
                objectType: 'Lead',
                description: 'Standard lifecycle based on Lead Status.',
                steps: leadStatus.records.map((r:any) => r.MasterLabel)
            });
        }
    } catch(e) { console.warn("Error fetching Lead Status", e); }

    // 3. Standard: Case
    try {
        const caseStatus = await fetchQuery(instanceUrl, accessToken, "SELECT MasterLabel FROM CaseStatus ORDER BY SortOrder ASC");
        if(caseStatus.records && caseStatus.records.length > 0) {
            results.push({
                id: 'std-case',
                label: 'Support Process',
                type: 'Standard',
                objectType: 'Case',
                description: 'Standard lifecycle based on Case Status.',
                steps: caseStatus.records.map((r:any) => r.MasterLabel)
            });
        }
    } catch(e) { console.warn("Error fetching Case Status", e); }

    // 4. Approval Processes
    try {
        const approvals = await fetchQuery(instanceUrl, accessToken, "SELECT Id, Name, TableEnumOrId, Description FROM ProcessDefinition WHERE State = 'Active' LIMIT 20");
        if(approvals.records) {
            approvals.records.forEach((rec: any) => {
                results.push({
                    id: rec.Id,
                    label: rec.Name,
                    type: 'Approval',
                    objectType: rec.TableEnumOrId,
                    description: rec.Description || `Approval process for ${rec.TableEnumOrId}`
                });
            });
        }
    } catch(e) { console.warn("Error fetching Approval Processes", e); }

    // 5. Flows
    try {
        const flows = await fetchQuery(instanceUrl, accessToken, "SELECT Id, Label, ProcessType, Description FROM FlowDefinitionView WHERE IsActive = true AND ProcessType IN ('Flow', 'AutoLaunchedFlow', 'Workflow') LIMIT 20");
        if(flows.records) {
            flows.records.forEach((rec: any) => {
                results.push({
                    id: rec.Id,
                    label: rec.Label,
                    type: 'Flow',
                    objectType: 'Flow',
                    description: rec.Description || `Salesforce ${rec.ProcessType}`
                });
            });
        }
    } catch(e) { console.warn("Error fetching Flows", e); }

    return results;
}

export const fetchApprovalProcessSteps = async (instanceUrl: string, accessToken: string, processDefId: string): Promise<string[]> => {
    try {
        const steps = await fetchQuery(instanceUrl, accessToken, `SELECT Name FROM ProcessNode WHERE ProcessDefinitionId = '${processDefId}' ORDER BY SystemModstamp ASC`);
        return steps.records ? steps.records.map((r:any) => r.Name) : [];
    } catch(e) { 
        console.warn("Error fetching approval steps", e);
        return []; 
    }
}
