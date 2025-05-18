// Extended utility functions for Xano tools

/**
 * Get API path for table operations
 */
export function getTableApiPath(instance: string, workspace: string | number, table?: string | number): string {
  const metaApi = getMetaApiUrl(instance);
  const workspaceId = formatId(workspace);
  
  if (table) {
    const tableId = formatId(table);
    return `${metaApi}/workspace/${workspaceId}/table/${tableId}`;
  }
  
  return `${metaApi}/workspace/${workspaceId}/table`;
}

/**
 * Get API path for schema operations
 */
export function getSchemaApiPath(instance: string, workspace: string | number, table: string | number): string {
  const metaApi = getMetaApiUrl(instance);
  const workspaceId = formatId(workspace);
  const tableId = formatId(table);
  
  return `${metaApi}/workspace/${workspaceId}/table/${tableId}/schema`;
}

/**
 * Get API path for record operations
 */
export function getRecordsApiPath(instance: string, workspace: string | number, table: string | number, record?: string | number): string {
  const metaApi = getMetaApiUrl(instance);
  const workspaceId = formatId(workspace);
  const tableId = formatId(table);
  
  if (record) {
    const recordId = formatId(record);
    return `${metaApi}/workspace/${workspaceId}/table/${tableId}/row/${recordId}`;
  }
  
  return `${metaApi}/workspace/${workspaceId}/table/${tableId}/row`;
}

/**
 * Get API path for index operations
 */
export function getIndexApiPath(instance: string, workspace: string | number, table: string | number, index?: string | number): string {
  const metaApi = getMetaApiUrl(instance);
  const workspaceId = formatId(workspace);
  const tableId = formatId(table);
  
  if (index) {
    const indexId = formatId(index);
    return `${metaApi}/workspace/${workspaceId}/table/${tableId}/index/${indexId}`;
  }
  
  return `${metaApi}/workspace/${workspaceId}/table/${tableId}/index`;
}

/**
 * Get API path for API group operations
 */
export function getApiGroupPath(instance: string, workspace: string | number, apiGroup?: string | number): string {
  const metaApi = getMetaApiUrl(instance);
  const workspaceId = formatId(workspace);
  
  if (apiGroup) {
    const apiGroupId = formatId(apiGroup);
    return `${metaApi}/workspace/${workspaceId}/apigroup/${apiGroupId}`;
  }
  
  return `${metaApi}/workspace/${workspaceId}/apigroup`;
}

/**
 * Get API path for API endpoint operations
 */
export function getApiPath(instance: string, workspace: string | number, apiGroup: string | number, api?: string | number): string {
  const metaApi = getMetaApiUrl(instance);
  const workspaceId = formatId(workspace);
  const apiGroupId = formatId(apiGroup);
  
  if (api) {
    const apiId = formatId(api);
    return `${metaApi}/workspace/${workspaceId}/apigroup/${apiGroupId}/api/${apiId}`;
  }
  
  return `${metaApi}/workspace/${workspaceId}/apigroup/${apiGroupId}/api`;
}

/**
 * Get API path for file operations
 */
export function getFilesApiPath(instance: string, workspace: string | number, file?: string | number): string {
  const metaApi = getMetaApiUrl(instance);
  const workspaceId = formatId(workspace);
  
  if (file) {
    const fileId = formatId(file);
    return `${metaApi}/workspace/${workspaceId}/file/${fileId}`;
  }
  
  return `${metaApi}/workspace/${workspaceId}/file`;
}

/**
 * Helper for consistent authentication checks
 */
export function checkAuthentication(props: any): { 
  isAuthenticated: boolean;
  apiKey?: string;
  errorContent?: { type: string; text: string }[];
} {
  const isAuthenticated = props?.authenticated || props?.user?.authenticated;
  
  if (!isAuthenticated) {
    return {
      isAuthenticated: false,
      errorContent: [{ 
        type: "text", 
        text: "Authentication required to use this tool." 
      }]
    };
  }
  
  const apiKey = props?.apiKey || props?.user?.apiKey;
  
  if (!apiKey) {
    return {
      isAuthenticated: true,
      errorContent: [{ 
        type: "text", 
        text: "API key not available. Please ensure you are authenticated." 
      }]
    };
  }
  
  return {
    isAuthenticated: true,
    apiKey
  };
}

/**
 * Helper for standardized error response
 */
export function createErrorResponse(message: string): { 
  content: { type: string; text: string }[] 
} {
  return {
    content: [{ 
      type: "text", 
      text: `Error: ${message}` 
    }]
  };
}

/**
 * Helper for standardized success response
 */
export function createSuccessResponse(data: any): { 
  content: { type: string; text: string }[] 
} {
  return {
    content: [{ 
      type: "text", 
      text: JSON.stringify(data) 
    }]
  };
}

// Import these functions from the existing utils.ts
import { getMetaApiUrl, formatId } from './utils';