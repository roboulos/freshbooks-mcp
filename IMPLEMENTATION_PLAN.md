# Xano MCP Server - Tool Implementation Plan

This document outlines the plan for implementing all the additional Xano tools from the Python SDK into the Cloudflare MCP Server project.

## Current Implementation
The project currently has the following tools implemented:
- `debug_auth`
- `hello`
- `xano_list_instances`
- `xano_get_instance_details`
- `xano_list_databases`
- `xano_get_workspace_details`
- `xano_list_tables`

## Tools to Be Added
The following tools need to be added to the codebase:

### Table Management Tools
- [x] `xano_list_tables` (already implemented)
- [ ] `xano_get_table_details`
- [ ] `xano_create_table`
- [ ] `xano_update_table`
- [ ] `xano_delete_table`

### Schema Management Tools
- [ ] `xano_get_table_schema`
- [ ] `xano_add_field_to_schema`
- [ ] `xano_rename_schema_field`
- [ ] `xano_delete_field`

### Index Management Tools
- [ ] `xano_list_indexes`
- [ ] `xano_create_btree_index`
- [ ] `xano_create_unique_index`
- [ ] `xano_create_search_index`
- [ ] `xano_delete_index`

### Record Management Tools
- [ ] `xano_browse_table_content`
- [ ] `xano_search_table_content`
- [ ] `xano_get_table_record`
- [ ] `xano_create_table_record`
- [ ] `xano_update_table_record`
- [ ] `xano_delete_table_record`

### Bulk Operations Tools
- [ ] `xano_bulk_create_records`
- [ ] `xano_bulk_update_records`
- [ ] `xano_bulk_delete_records`
- [ ] `xano_truncate_table`

### File Management Tools
- [ ] `xano_list_files`
- [ ] `xano_get_file_details`
- [ ] `xano_delete_file`
- [ ] `xano_bulk_delete_files`

### API Management Tools
- [ ] `xano_browse_api_groups`
- [ ] `xano_get_api_group`
- [ ] `xano_create_api_group`
- [ ] `xano_update_api_group`
- [ ] `xano_delete_api_group`
- [ ] `xano_update_api_group_security`
- [ ] `xano_browse_apis_in_group`
- [ ] `xano_get_api`
- [ ] `xano_create_api`
- [ ] `xano_update_api`
- [ ] `xano_delete_api`
- [ ] `xano_update_api_security`

### Export Operations Tools
- [ ] `xano_export_workspace`
- [ ] `xano_export_workspace_schema`
- [ ] `xano_browse_request_history`

## Implementation Approach

### 1. Enhance Utility Functions
Add useful helper functions to `utils.ts` that will facilitate implementing the tools:

```typescript
// Add utility functions for building API paths
export function getTableApiPath(instance: string, workspace: string | number, table?: string | number): string {
  const metaApi = getMetaApiUrl(instance);
  const workspaceId = formatId(workspace);
  
  if (table) {
    const tableId = formatId(table);
    return `${metaApi}/workspace/${workspaceId}/table/${tableId}`;
  }
  
  return `${metaApi}/workspace/${workspaceId}/table`;
}

export function getSchemaApiPath(instance: string, workspace: string | number, table: string | number): string {
  const metaApi = getMetaApiUrl(instance);
  const workspaceId = formatId(workspace);
  const tableId = formatId(table);
  
  return `${metaApi}/workspace/${workspaceId}/table/${tableId}/schema`;
}

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

export function getApiGroupPath(instance: string, workspace: string | number, apiGroup?: string | number): string {
  const metaApi = getMetaApiUrl(instance);
  const workspaceId = formatId(workspace);
  
  if (apiGroup) {
    const apiGroupId = formatId(apiGroup);
    return `${metaApi}/workspace/${workspaceId}/apigroup/${apiGroupId}`;
  }
  
  return `${metaApi}/workspace/${workspaceId}/apigroup`;
}

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

export function getFilesApiPath(instance: string, workspace: string | number, file?: string | number): string {
  const metaApi = getMetaApiUrl(instance);
  const workspaceId = formatId(workspace);
  
  if (file) {
    const fileId = formatId(file);
    return `${metaApi}/workspace/${workspaceId}/file/${fileId}`;
  }
  
  return `${metaApi}/workspace/${workspaceId}/file`;
}

// Helper for consistent authentication checks
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

// Helper for standardized error response
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

// Helper for standardized success response
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
```

### 2. Implement Tool Categories in Order

For each tool, we'll follow this implementation template:

```typescript
this.server.tool(
  "xano_tool_name",
  {
    // Define parameters with Zod
    instance_name: z.string().describe("The name of the Xano instance"),
    // Additional parameters...
  },
  async ({ instance_name, /* other params */ }) => {
    // Check authentication
    const auth = checkAuthentication(this.props);
    if (!auth.isAuthenticated || auth.errorContent) {
      return { content: auth.errorContent };
    }

    try {
      // Build API URL using utility functions
      const url = getXxxApiPath(instance_name, other_params);
      
      // Make API request
      const result = await makeApiRequest(url, auth.apiKey, "METHOD", data);

      // Handle errors
      if (result.error) {
        return createErrorResponse(result.error);
      }

      // Return success response
      return createSuccessResponse(result);
    } catch (error) {
      console.error(`Error in xano_tool_name: ${error.message}`);
      return createErrorResponse(`Error in xano_tool_name: ${error.message}`);
    }
  }
);
```

### 3. Implementation Schedule

#### Phase 1: Core Table and Schema Tools
- `xano_get_table_details`
- `xano_get_table_schema`
- `xano_create_table`
- `xano_update_table`
- `xano_delete_table`
- `xano_add_field_to_schema`
- `xano_rename_schema_field`
- `xano_delete_field`

#### Phase 2: Record Management Tools
- `xano_browse_table_content`
- `xano_search_table_content`
- `xano_get_table_record`
- `xano_create_table_record`
- `xano_update_table_record`
- `xano_delete_table_record`

#### Phase 3: Bulk Operations and Index Tools
- `xano_bulk_create_records`
- `xano_bulk_update_records`
- `xano_bulk_delete_records`
- `xano_truncate_table`
- `xano_list_indexes`
- `xano_create_btree_index`
- `xano_create_unique_index`
- `xano_create_search_index`
- `xano_delete_index`

#### Phase 4: File Management and API Tools
- `xano_list_files`
- `xano_get_file_details`
- `xano_delete_file`
- `xano_bulk_delete_files`
- `xano_browse_api_groups`
- `xano_get_api_group`
- `xano_create_api_group`
- All other API-related tools

#### Phase 5: Export Operations
- `xano_export_workspace`
- `xano_export_workspace_schema`
- `xano_browse_request_history`

## Example Implementation: Table Management Tools

Here's an example of implementing the first two tools from Phase 1:

```typescript
// xano_get_table_details
this.server.tool(
  "xano_get_table_details",
  {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table")
  },
  async ({ instance_name, workspace_id, table_id }) => {
    const auth = checkAuthentication(this.props);
    if (!auth.isAuthenticated || auth.errorContent) {
      return { content: auth.errorContent };
    }

    try {
      const url = getTableApiPath(instance_name, workspace_id, table_id);
      const result = await makeApiRequest(url, auth.apiKey);

      if (result.error) {
        return createErrorResponse(result.error);
      }

      return createSuccessResponse(result);
    } catch (error) {
      console.error(`Error getting table details: ${error.message}`);
      return createErrorResponse(`Error getting table details: ${error.message}`);
    }
  }
);

// xano_get_table_schema
this.server.tool(
  "xano_get_table_schema",
  {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table")
  },
  async ({ instance_name, workspace_id, table_id }) => {
    const auth = checkAuthentication(this.props);
    if (!auth.isAuthenticated || auth.errorContent) {
      return { content: auth.errorContent };
    }

    try {
      const url = getSchemaApiPath(instance_name, workspace_id, table_id);
      const result = await makeApiRequest(url, auth.apiKey);

      if (result.error) {
        return createErrorResponse(result.error);
      }

      return createSuccessResponse({ schema: result });
    } catch (error) {
      console.error(`Error getting table schema: ${error.message}`);
      return createErrorResponse(`Error getting table schema: ${error.message}`);
    }
  }
);
```

## Testing Plan

For each group of tools:

1. Test basic functionality with a test Xano instance
2. Verify authentication handling
3. Test error handling
4. Document any issues or adjustments needed

## Continuous Integration

After implementing each phase:

1. Ensure all tools have consistent error handling and response formats
2. Update documentation as needed
3. Test thoroughly before moving to the next phase