import { SObject, OrgMetadata, SField } from '../types';

// Mock data generation
const generateFields = (objName: string, count: number): SField[] => {
  const fields: SField[] = [
    { apiName: 'Id', label: 'Record ID', type: 'Id', isCustom: false },
    { apiName: 'Name', label: 'Name', type: 'String', isCustom: false },
    { apiName: 'CreatedDate', label: 'Created Date', type: 'DateTime', isCustom: false },
    { apiName: 'LastModifiedDate', label: 'Last Modified Date', type: 'DateTime', isCustom: false },
  ];
  
  for (let i = 0; i < count; i++) {
    fields.push({
      apiName: `${objName}_Field_${i}__c`,
      label: `${objName} Field ${i}`,
      type: i % 3 === 0 ? 'Text' : i % 3 === 1 ? 'Number' : 'Lookup',
      isCustom: true,
      description: `Custom field for tracking ${objName} details.`
    });
  }
  return fields;
};

const mockObjects: SObject[] = [
  {
    apiName: 'Account',
    label: 'Account',
    isCustom: false,
    description: 'Standard object for storing customer accounts.',
    fields: generateFields('Account', 15),
    recordCount: 12500
  },
  {
    apiName: 'Contact',
    label: 'Contact',
    isCustom: false,
    description: 'Standard object for storing individual contacts associated with accounts.',
    fields: generateFields('Contact', 10),
    recordCount: 34000
  },
  {
    apiName: 'Opportunity',
    label: 'Opportunity',
    isCustom: false,
    description: 'Standard object for tracking potential sales and revenue.',
    fields: generateFields('Opportunity', 25),
    recordCount: 5600
  },
  {
    apiName: 'Invoice__c',
    label: 'Invoice',
    isCustom: true,
    description: 'Custom object for managing customer invoices and billing.',
    fields: generateFields('Invoice', 8),
    recordCount: 2100
  },
  {
    apiName: 'Project_Log__c',
    label: 'Project Log',
    isCustom: true,
    description: 'Tracks status updates for ongoing projects.',
    fields: generateFields('Project_Log', 5),
    recordCount: 450
  }
];

export const loginToSalesforce = async (username: string): Promise<OrgMetadata> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        orgId: '00D5g000004RhXk',
        orgName: `${username.split('@')[1] || 'Salesforce'} Org`,
        instanceUrl: 'https://mock.salesforce.com',
        accessToken: 'mock_access_token_12345',
        objects: mockObjects
      });
    }, 1500);
  });
};