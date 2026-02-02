
import { GoogleGenAI, Type } from "@google/genai";
import { OrgMetadata, ProcessDiagram } from '../types';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateDiagramFromRequirement = async (requirement: string, context: OrgMetadata): Promise<any | null> => {
  try {
    const ai = getAiClient();
    const model = 'gemini-3-pro-preview';

    // Summarize context for the model
    const objects = context.objects || [];
    const objectList = objects.map(o => o.apiName).join(', ');

    const prompt = `
      You are a Salesforce Business Architect using UPN (Universal Process Notation).
      
      Context - Available Objects: ${objectList}
      
      User Requirement: "${requirement}"
      
      Task: Create a UPN process map JSON.
      
      Rules:
      1. 'upn-activity' nodes must have: 
         - label (Verb + Noun, e.g. "Create Order")
         - outcome (Verifiable result, e.g. "Order Created")
         - resources (Who does it? e.g. "Sales Rep", "Salesforce")
      2. 'start' and 'end' nodes for boundaries.
      3. Connect logically.
      
      Return STRICT JSON:
      {
        "title": "Process Title",
        "description": "Process Description",
        "nodes": [
           { 
             "id": "n1", 
             "type": "upn-activity", 
             "data": {
               "label": "Validate Account",
               "outcome": "Account Verified",
               "resources": [{"resourceId": "sys-sf", "rasci": {"r":true,"a":false,"s":false,"c":false,"i":false}}]
             }
           }
        ],
        "edges": [...]
      }
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return null;

  } catch (error) {
    console.error("Error generating diagram:", error);
    throw error;
  }
};

export const chatWithOrgData = async (
  message: string, 
  history: { role: string; content: string }[], 
  metadata: OrgMetadata
): Promise<string> => {
  try {
    const ai = getAiClient();
    const model = 'gemini-3-flash-preview';

    // Prepare context
    const objects = metadata.objects || [];
    const contextSummary = `
      You are 'ElementsGPT', an AI assistant for a Salesforce Org named '${metadata.orgName}'.
      
      Metadata Summary:
      ${objects.map(obj => 
        `- Object: ${obj.label} (${obj.apiName}), Custom: ${obj.isCustom}`
      ).join('\n')}
      
      You help users understand their org metadata, suggest improvements, and explain relationships.
      Keep answers concise and professional.
    `;

    const chat = ai.chats.create({
      model,
      config: {
        systemInstruction: contextSummary,
      },
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.content }]
      }))
    });

    const result = await chat.sendMessage({ message });
    return result.text || "I couldn't generate a response.";

  } catch (error) {
    console.error("Chat error:", error);
    return "I apologize, but I'm having trouble connecting to the AI service right now. Please ensure your API key is valid.";
  }
};

export const summarizeRecord = async (objectType: string, recordData: any, relatedData: any = {}): Promise<string> => {
    try {
        const ai = getAiClient();
        const model = 'gemini-3-flash-preview';

        const prompt = `
            Analyze this Salesforce ${objectType} record and its related data.
            
            **Record Data:** 
            ${JSON.stringify(recordData, null, 2)}
            
            **Related Records (Sub-queries):**
            ${JSON.stringify(relatedData, null, 2)}
            
            Please provide a comprehensive summary including:
            1. **Business Summary**: A narrative description of what this record represents. If it's an Account, mention industries or status. If related Opportunities or Cases exist, mention them (e.g. "Has 3 open cases and active deals").
            2. **Key Decisions/Timeline**: Infer progress based on CreatedDate, LastModifiedDate, and specific status fields.
            3. **Technical Aspects**: Highlight missing fields, data quality, or specific system attributes.
            
            Format the output in clear Markdown with headers. Keep it concise but insightful.
        `;

        const response = await ai.models.generateContent({
            model,
            contents: prompt
        });

        return response.text || "Could not generate summary.";
    } catch (error) {
        console.error("Summary error:", error);
        return "Failed to generate AI summary.";
    }
};
