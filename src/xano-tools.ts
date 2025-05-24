import { z } from "zod";
import { makeApiRequest, getMetaApiUrl, formatId } from "./utils";

// Helper functions for building API paths
function getTableApiPath(instance: string, workspace: string | number, table?: string | number): string {
  const metaApi = getMetaApiUrl(instance);
  const workspaceId = formatId(workspace);
  
  if (table) {
    const tableId = formatId(table);
    return `${metaApi}/workspace/${workspaceId}/table/${tableId}`;
  }
  
  return `${metaApi}/workspace/${workspaceId}/table`;
}

function getSchemaApiPath(instance: string, workspace: string | number, table: string | number): string {
  const metaApi = getMetaApiUrl(instance);
  const workspaceId = formatId(workspace);
  const tableId = formatId(table);
  
  return `${metaApi}/workspace/${workspaceId}/table/${tableId}/schema`;
}

function getRecordsApiPath(instance: string, workspace: string | number, table: string | number, record?: string | number): string {
  const metaApi = getMetaApiUrl(instance);
  const workspaceId = formatId(workspace);
  const tableId = formatId(table);
  
  if (record) {
    const recordId = formatId(record);
    return `${metaApi}/workspace/${workspaceId}/table/${tableId}/row/${recordId}`;
  }
  
  return `${metaApi}/workspace/${workspaceId}/table/${tableId}/row`;
}

function getIndexApiPath(instance: string, workspace: string | number, table: string | number, index?: string | number): string {
  const metaApi = getMetaApiUrl(instance);
  const workspaceId = formatId(workspace);
  const tableId = formatId(table);
  
  if (index) {
    const indexId = formatId(index);
    return `${metaApi}/workspace/${workspaceId}/table/${tableId}/index/${indexId}`;
  }
  
  return `${metaApi}/workspace/${workspaceId}/table/${tableId}/index`;
}

function getApiGroupPath(instance: string, workspace: string | number, apiGroup?: string | number): string {
  const metaApi = getMetaApiUrl(instance);
  const workspaceId = formatId(workspace);
  
  if (apiGroup) {
    const apiGroupId = formatId(apiGroup);
    return `${metaApi}/workspace/${workspaceId}/apigroup/${apiGroupId}`;
  }
  
  return `${metaApi}/workspace/${workspaceId}/apigroup`;
}

function getApiPath(instance: string, workspace: string | number, apiGroup: string | number, api?: string | number): string {
  const metaApi = getMetaApiUrl(instance);
  const workspaceId = formatId(workspace);
  const apiGroupId = formatId(apiGroup);
  
  if (api) {
    const apiId = formatId(api);
    return `${metaApi}/workspace/${workspaceId}/apigroup/${apiGroupId}/api/${apiId}`;
  }
  
  return `${metaApi}/workspace/${workspaceId}/apigroup/${apiGroupId}/api`;
}

function getFilesApiPath(instance: string, workspace: string | number, file?: string | number): string {
  const metaApi = getMetaApiUrl(instance);
  const workspaceId = formatId(workspace);
  
  if (file) {
    const fileId = formatId(file);
    return `${metaApi}/workspace/${workspaceId}/file/${fileId}`;
  }
  
  return `${metaApi}/workspace/${workspaceId}/file`;
}

function checkAuth(props: any): { error?: string; apiKey?: string } {
  const isAuthenticated = props?.authenticated || props?.user?.authenticated;
  if (!isAuthenticated) {
    return { error: "Authentication required to use this tool." };
  }
  
  const apiKey = props?.apiKey || props?.user?.apiKey;
  if (!apiKey) {
    return { error: "API key not available. Please ensure you are authenticated." };
  }
  
  return { apiKey };
}

function handleResponse(result: any): {
  content: { type: string; text: string }[]
} {
  return {
    content: [{
      type: "text",
      text: JSON.stringify(result)
    }]
  };
}

function handleError(error: any): {
  content: { type: string; text: string }[]
} {
  const errorMsg = error.error || error.message || String(error);
  return {
    content: [{
      type: "text",
      text: `Error: ${errorMsg}`
    }]
  };
}

// SECTION: TABLE MANAGEMENT TOOLS

// Get table details
export const getTableDetails = {
  name: "xano_get_table_details",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table")
  },
  handler: async ({ instance_name, workspace_id, table_id }, props) => {
    const auth = checkAuth(props);
    if (auth.error) {
      return handleError(auth.error);
    }

    try {
      const url = getTableApiPath(instance_name, workspace_id, table_id);
      const result = await makeApiRequest(url, auth.apiKey);

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error getting table details: ${error.message}`);
      return handleError(error);
    }
  }
};

// Create a new table
export const createTable = {
  name: "xano_create_table",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    name: z.string().describe("The name of the new table"),
    description: z.string().optional().describe("Table description"),
    docs: z.string().optional().describe("Documentation text"),
    auth: z.boolean().optional().describe("Whether authentication is required"),
    tag: z.array(z.string()).optional().describe("List of tags for the table")
  },
  handler: async ({ instance_name, workspace_id, name, description, docs, auth, tag }, props) => {
    const authCheck = checkAuth(props);
    if (authCheck.error) {
      return handleError(authCheck.error);
    }

    try {
      const url = getTableApiPath(instance_name, workspace_id);
      const data = {
        name,
        description: description || "",
        docs: docs || "",
        auth: auth || false,
        tag: tag || []
      };
      
      const result = await makeApiRequest(url, authCheck.apiKey, "POST", data);

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error creating table: ${error.message}`);
      return handleError(error);
    }
  }
};

// Update an existing table
export const updateTable = {
  name: "xano_update_table",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table to update"),
    name: z.string().optional().describe("The new name of the table"),
    description: z.string().optional().describe("New table description"),
    docs: z.string().optional().describe("New documentation text"),
    auth: z.boolean().optional().describe("New authentication setting"),
    tag: z.array(z.string()).optional().describe("New list of tags for the table")
  },
  handler: async ({ instance_name, workspace_id, table_id, name, description, docs, auth, tag }, props) => {
    const authCheck = checkAuth(props);
    if (authCheck.error) {
      return handleError(authCheck.error);
    }

    try {
      const url = getTableApiPath(instance_name, workspace_id, table_id);
      
      // Only include fields that are provided
      const data: any = {};
      if (name !== undefined) data.name = name;
      if (description !== undefined) data.description = description;
      if (docs !== undefined) data.docs = docs;
      if (auth !== undefined) data.auth = auth;
      if (tag !== undefined) data.tag = tag;
      
      const result = await makeApiRequest(url, authCheck.apiKey, "PUT", data);

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error updating table: ${error.message}`);
      return handleError(error);
    }
  }
};

// Delete a table
export const deleteTable = {
  name: "xano_delete_table",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table to delete")
  },
  handler: async ({ instance_name, workspace_id, table_id }, props) => {
    const auth = checkAuth(props);
    if (auth.error) {
      return handleError(auth.error);
    }

    try {
      const url = getTableApiPath(instance_name, workspace_id, table_id);
      const result = await makeApiRequest(url, auth.apiKey, "DELETE");

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error deleting table: ${error.message}`);
      return handleError(error);
    }
  }
};

// Get table schema
export const getTableSchema = {
  name: "xano_get_table_schema",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table")
  },
  handler: async ({ instance_name, workspace_id, table_id }, props) => {
    const auth = checkAuth(props);
    if (auth.error) {
      return handleError(auth.error);
    }

    try {
      const url = getSchemaApiPath(instance_name, workspace_id, table_id);
      const result = await makeApiRequest(url, auth.apiKey);

      if (result.error) {
        return handleError(result);
      }

      return handleResponse({ schema: result });
    } catch (error) {
      console.error(`Error getting table schema: ${error.message}`);
      return handleError(error);
    }
  }
};

// SECTION: SCHEMA MANAGEMENT TOOLS

// Add a field to schema
export const addFieldToSchema = {
  name: "xano_add_field_to_schema",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
    field_name: z.string().describe("The name of the new field"),
    field_type: z.string().describe("The type of the field (e.g., \"text\", \"int\", \"decimal\", \"boolean\", \"date\")"),
    description: z.string().optional().describe("Field description"),
    nullable: z.boolean().optional().describe("Whether the field can be null"),
    default_value: z.any().optional().describe("Default value for the field"),
    required: z.boolean().optional().describe("Whether the field is required"),
    access: z.string().optional().describe("Field access level (\"public\", \"private\", \"internal\")"),
    sensitive: z.boolean().optional().describe("Whether the field contains sensitive data"),
    style: z.string().optional().describe("Field style (\"single\" or \"list\")"),
    validators: z.record(z.any()).optional().describe("Validation rules specific to the field type")
  },
  handler: async ({ 
    instance_name, workspace_id, table_id, field_name, field_type,
    description, nullable, default_value, required, access, sensitive, style, validators
  }, props) => {
    const auth = checkAuth(props);
    if (auth.error) {
      return handleError(auth.error);
    }

    try {
      const url = getSchemaApiPath(instance_name, workspace_id, table_id);
      
      const data = {
        name: field_name,
        type: field_type,
        description: description || "",
        nullable: nullable !== undefined ? nullable : false,
        default: default_value,
        required: required !== undefined ? required : false,
        access: access || "public",
        sensitive: sensitive !== undefined ? sensitive : false,
        style: style || "single",
        validators: validators || null
      };
      
      const result = await makeApiRequest(url, auth.apiKey, "POST", data);

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error adding field to schema: ${error.message}`);
      return handleError(error);
    }
  }
};

// Rename a schema field
export const renameSchemaField = {
  name: "xano_rename_schema_field",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
    old_name: z.string().describe("The current name of the field"),
    new_name: z.string().describe("The new name for the field")
  },
  handler: async ({ instance_name, workspace_id, table_id, old_name, new_name }, props) => {
    const auth = checkAuth(props);
    if (auth.error) {
      return handleError(auth.error);
    }

    try {
      const url = `${getSchemaApiPath(instance_name, workspace_id, table_id)}/${old_name}/rename`;
      
      const data = {
        new_name: new_name
      };
      
      const result = await makeApiRequest(url, auth.apiKey, "PUT", data);

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error renaming schema field: ${error.message}`);
      return handleError(error);
    }
  }
};

// Delete a field from schema
export const deleteField = {
  name: "xano_delete_field",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
    field_name: z.string().describe("The name of the field to delete")
  },
  handler: async ({ instance_name, workspace_id, table_id, field_name }, props) => {
    const auth = checkAuth(props);
    if (auth.error) {
      return handleError(auth.error);
    }

    try {
      const url = `${getSchemaApiPath(instance_name, workspace_id, table_id)}/${field_name}`;
      
      const result = await makeApiRequest(url, auth.apiKey, "DELETE");

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error deleting field: ${error.message}`);
      return handleError(error);
    }
  }
};

// SECTION: RECORD MANAGEMENT TOOLS

// Browse table content
export const browseTableContent = {
  name: "xano_browse_table_content",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
    page: z.number().optional().describe("Page number (default: 1)"),
    per_page: z.number().optional().describe("Number of records per page (default: 50)")
  },
  handler: async ({ instance_name, workspace_id, table_id, page, per_page }, props) => {
    const auth = checkAuth(props);
    if (auth.error) {
      return handleError(auth.error);
    }

    try {
      const baseUrl = getRecordsApiPath(instance_name, workspace_id, table_id);
      
      // Add pagination parameters to URL
      const params = new URLSearchParams();
      if (page !== undefined) params.append('page', page.toString());
      if (per_page !== undefined) params.append('per_page', per_page.toString());
      
      const url = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
      const result = await makeApiRequest(url, auth.apiKey);

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error browsing table content: ${error.message}`);
      return handleError(error);
    }
  }
};

// Search table content
export const searchTableContent = {
  name: "xano_search_table_content",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
    search_conditions: z.array(z.record(z.any())).optional().describe("List of search conditions"),
    sort: z.record(z.string()).optional().describe("Dictionary with field names as keys and \"asc\" or \"desc\" as values"),
    page: z.number().optional().describe("Page number (default: 1)"),
    per_page: z.number().optional().describe("Number of records per page (default: 50)")
  },
  handler: async ({ instance_name, workspace_id, table_id, search_conditions, sort, page, per_page }, props) => {
    const auth = checkAuth(props);
    if (auth.error) {
      return handleError(auth.error);
    }

    try {
      const url = `${getRecordsApiPath(instance_name, workspace_id, table_id)}/search`;
      
      const data = {
        search: search_conditions || [],
        sort: sort || {},
        page: page || 1,
        per_page: per_page || 50
      };
      
      const result = await makeApiRequest(url, auth.apiKey, "POST", data);

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error searching table content: ${error.message}`);
      return handleError(error);
    }
  }
};

// Get a single table record
export const getTableRecord = {
  name: "xano_get_table_record",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
    record_id: z.union([z.string(), z.number()]).describe("The ID of the record to retrieve")
  },
  handler: async ({ instance_name, workspace_id, table_id, record_id }, props) => {
    const auth = checkAuth(props);
    if (auth.error) {
      return handleError(auth.error);
    }

    try {
      const url = getRecordsApiPath(instance_name, workspace_id, table_id, record_id);
      const result = await makeApiRequest(url, auth.apiKey);

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error getting table record: ${error.message}`);
      return handleError(error);
    }
  }
};

// Create a new table record
export const createTableRecord = {
  name: "xano_create_table_record",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
    record_data: z.record(z.any()).describe("The data for the new record")
  },
  handler: async ({ instance_name, workspace_id, table_id, record_data }, props) => {
    const auth = checkAuth(props);
    if (auth.error) {
      return handleError(auth.error);
    }

    try {
      const url = getRecordsApiPath(instance_name, workspace_id, table_id);
      const result = await makeApiRequest(url, auth.apiKey, "POST", record_data);

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error creating table record: ${error.message}`);
      return handleError(error);
    }
  }
};

// Update a table record
export const updateTableRecord = {
  name: "xano_update_table_record",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
    record_id: z.union([z.string(), z.number()]).describe("The ID of the record to update"),
    record_data: z.record(z.any()).describe("The updated data for the record")
  },
  handler: async ({ instance_name, workspace_id, table_id, record_id, record_data }, props) => {
    const auth = checkAuth(props);
    if (auth.error) {
      return handleError(auth.error);
    }

    try {
      const url = getRecordsApiPath(instance_name, workspace_id, table_id, record_id);
      const result = await makeApiRequest(url, auth.apiKey, "PUT", record_data);

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error updating table record: ${error.message}`);
      return handleError(error);
    }
  }
};

// Delete a table record
export const deleteTableRecord = {
  name: "xano_delete_table_record",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
    record_id: z.union([z.string(), z.number()]).describe("The ID of the record to delete")
  },
  handler: async ({ instance_name, workspace_id, table_id, record_id }, props) => {
    const auth = checkAuth(props);
    if (auth.error) {
      return handleError(auth.error);
    }

    try {
      const url = getRecordsApiPath(instance_name, workspace_id, table_id, record_id);
      const result = await makeApiRequest(url, auth.apiKey, "DELETE");

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error deleting table record: ${error.message}`);
      return handleError(error);
    }
  }
};

// SECTION: BULK OPERATIONS

// Bulk create records
export const bulkCreateRecords = {
  name: "xano_bulk_create_records",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
    records: z.array(z.record(z.any())).describe("List of record data to insert"),
    allow_id_field: z.boolean().optional().describe("Whether to allow setting the ID field")
  },
  handler: async ({ instance_name, workspace_id, table_id, records, allow_id_field }, props) => {
    const auth = checkAuth(props);
    if (auth.error) {
      return handleError(auth.error);
    }

    try {
      const url = `${getRecordsApiPath(instance_name, workspace_id, table_id)}/bulk`;
      
      const data = {
        records,
        allow_id_field: allow_id_field || false
      };
      
      const result = await makeApiRequest(url, auth.apiKey, "POST", data);

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error bulk creating records: ${error.message}`);
      return handleError(error);
    }
  }
};

// Bulk update records
export const bulkUpdateRecords = {
  name: "xano_bulk_update_records",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
    updates: z.array(z.object({
      row_id: z.union([z.string(), z.number()]),
      updates: z.record(z.any())
    })).describe("List of update operations, each containing row_id and updates")
  },
  handler: async ({ instance_name, workspace_id, table_id, updates }, props) => {
    const auth = checkAuth(props);
    if (auth.error) {
      return handleError(auth.error);
    }

    try {
      const url = `${getRecordsApiPath(instance_name, workspace_id, table_id)}/bulk`;
      
      const result = await makeApiRequest(url, auth.apiKey, "PUT", { updates });

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error bulk updating records: ${error.message}`);
      return handleError(error);
    }
  }
};

// Bulk delete records
export const bulkDeleteRecords = {
  name: "xano_bulk_delete_records",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
    record_ids: z.array(z.union([z.string(), z.number()])).describe("List of record IDs to delete")
  },
  handler: async ({ instance_name, workspace_id, table_id, record_ids }, props) => {
    const auth = checkAuth(props);
    if (auth.error) {
      return handleError(auth.error);
    }

    try {
      const url = `${getRecordsApiPath(instance_name, workspace_id, table_id)}/bulk`;
      
      const result = await makeApiRequest(url, auth.apiKey, "DELETE", { record_ids });

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error bulk deleting records: ${error.message}`);
      return handleError(error);
    }
  }
};

// Truncate table
export const truncateTable = {
  name: "xano_truncate_table",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
    reset: z.boolean().optional().describe("Whether to reset the primary key counter")
  },
  handler: async ({ instance_name, workspace_id, table_id, reset }, props) => {
    const auth = checkAuth(props);
    if (auth.error) {
      return handleError(auth.error);
    }

    try {
      const url = `${getRecordsApiPath(instance_name, workspace_id, table_id)}/truncate`;
      
      const result = await makeApiRequest(url, auth.apiKey, "POST", { reset: reset || false });

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error truncating table: ${error.message}`);
      return handleError(error);
    }
  }
};

// SECTION: INDEX MANAGEMENT

// List indexes
export const listIndexes = {
  name: "xano_list_indexes",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table")
  },
  handler: async ({ instance_name, workspace_id, table_id }, props) => {
    const auth = checkAuth(props);
    if (auth.error) {
      return handleError(auth.error);
    }

    try {
      const url = getIndexApiPath(instance_name, workspace_id, table_id);
      const result = await makeApiRequest(url, auth.apiKey);

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error listing indexes: ${error.message}`);
      return handleError(error);
    }
  }
};

// Create btree index
export const createBtreeIndex = {
  name: "xano_create_btree_index",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
    fields: z.array(z.object({
      name: z.string(),
      op: z.enum(["asc", "desc"])
    })).describe("List of fields and operations for the index")
  },
  handler: async ({ instance_name, workspace_id, table_id, fields }, props) => {
    const auth = checkAuth(props);
    if (auth.error) {
      return handleError(auth.error);
    }

    try {
      const url = `${getIndexApiPath(instance_name, workspace_id, table_id)}/btree`;
      
      const result = await makeApiRequest(url, auth.apiKey, "POST", { fields });

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error creating btree index: ${error.message}`);
      return handleError(error);
    }
  }
};

// Create unique index
export const createUniqueIndex = {
  name: "xano_create_unique_index",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
    fields: z.array(z.object({
      name: z.string(),
      op: z.enum(["asc", "desc"])
    })).describe("List of fields and operations for the index")
  },
  handler: async ({ instance_name, workspace_id, table_id, fields }, props) => {
    const auth = checkAuth(props);
    if (auth.error) {
      return handleError(auth.error);
    }

    try {
      const url = `${getIndexApiPath(instance_name, workspace_id, table_id)}/unique`;
      
      const result = await makeApiRequest(url, auth.apiKey, "POST", { fields });

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error creating unique index: ${error.message}`);
      return handleError(error);
    }
  }
};

// Create search index
export const createSearchIndex = {
  name: "xano_create_search_index",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
    name: z.string().describe("Name for the search index"),
    lang: z.string().describe("Language for the search index (e.g., \"english\", \"spanish\", etc.)"),
    fields: z.array(z.object({
      name: z.string(),
      priority: z.number()
    })).describe("List of fields and priorities")
  },
  handler: async ({ instance_name, workspace_id, table_id, name, lang, fields }, props) => {
    const auth = checkAuth(props);
    if (auth.error) {
      return handleError(auth.error);
    }

    try {
      const url = `${getIndexApiPath(instance_name, workspace_id, table_id)}/search`;
      
      const result = await makeApiRequest(url, auth.apiKey, "POST", { name, lang, fields });

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error creating search index: ${error.message}`);
      return handleError(error);
    }
  }
};

// Delete index
export const deleteIndex = {
  name: "xano_delete_index",
  parameters: {
    instance_name: z.string().describe("The name of the Xano instance"),
    workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
    table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
    index_id: z.union([z.string(), z.number()]).describe("The ID of the index to delete")
  },
  handler: async ({ instance_name, workspace_id, table_id, index_id }, props) => {
    const auth = checkAuth(props);
    if (auth.error) {
      return handleError(auth.error);
    }

    try {
      const url = getIndexApiPath(instance_name, workspace_id, table_id, index_id);
      const result = await makeApiRequest(url, auth.apiKey, "DELETE");

      if (result.error) {
        return handleError(result);
      }

      return handleResponse(result);
    } catch (error) {
      console.error(`Error deleting index: ${error.message}`);
      return handleError(error);
    }
  }
};

// Export all tools as an array for easy registration
export const allXanoTools = [
  // Table management
  getTableDetails,
  createTable,
  updateTable,
  deleteTable,
  getTableSchema,
  
  // Schema management
  addFieldToSchema,
  renameSchemaField,
  deleteField,
  
  // Record management
  browseTableContent,
  searchTableContent,
  getTableRecord,
  createTableRecord,
  updateTableRecord,
  deleteTableRecord,
  
  // Bulk operations
  bulkCreateRecords,
  bulkUpdateRecords,
  bulkDeleteRecords,
  truncateTable,
  
  // Index management
  listIndexes,
  createBtreeIndex,
  createUniqueIndex,
  createSearchIndex,
  deleteIndex
];