import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { 
  getTableApiPath, 
  getSchemaApiPath, 
  checkAuthentication, 
  createErrorResponse, 
  createSuccessResponse, 
  getRecordsApiPath,
  getIndexApiPath
} from "./utils-extended";
import { makeApiRequest } from "./utils";

/**
 * Registers table management tools with the MCP server
 */
export function registerTableTools(server: McpServer, props: any) {
  // Get table details
  server.tool(
    "xano_get_table_details",
    {
      instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
      workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
      table_id: z.union([z.string(), z.number()]).describe("The ID of the table")
    },
    async ({ instance_name, workspace_id, table_id }) => {
      const auth = checkAuthentication(props);
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

  // Get table schema
  server.tool(
    "xano_get_table_schema",
    {
      instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
      workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
      table_id: z.union([z.string(), z.number()]).describe("The ID of the table")
    },
    async ({ instance_name, workspace_id, table_id }) => {
      const auth = checkAuthentication(props);
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

  // Create table
  server.tool(
    "xano_create_table",
    {
      instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
      workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
      name: z.string().describe("The name of the new table"),
      description: z.string().optional().describe("Table description"),
      docs: z.string().optional().describe("Documentation text"),
      auth: z.boolean().optional().describe("Whether authentication is required"),
      tag: z.array(z.string()).optional().describe("List of tags for the table")
    },
    async ({ instance_name, workspace_id, name, description, docs, auth, tag }) => {
      const authCheck = checkAuthentication(props);
      if (!authCheck.isAuthenticated || authCheck.errorContent) {
        return { content: authCheck.errorContent };
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
          return createErrorResponse(result.error);
        }

        return createSuccessResponse(result);
      } catch (error) {
        console.error(`Error creating table: ${error.message}`);
        return createErrorResponse(`Error creating table: ${error.message}`);
      }
    }
  );

  // Update table
  server.tool(
    "xano_update_table",
    {
      instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
      workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
      table_id: z.union([z.string(), z.number()]).describe("The ID of the table to update"),
      name: z.string().optional().describe("The new name of the table"),
      description: z.string().optional().describe("New table description"),
      docs: z.string().optional().describe("New documentation text"),
      auth: z.boolean().optional().describe("New authentication setting"),
      tag: z.array(z.string()).optional().describe("New list of tags for the table")
    },
    async ({ instance_name, workspace_id, table_id, name, description, docs, auth, tag }) => {
      const authCheck = checkAuthentication(props);
      if (!authCheck.isAuthenticated || authCheck.errorContent) {
        return { content: authCheck.errorContent };
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
          return createErrorResponse(result.error);
        }

        return createSuccessResponse(result);
      } catch (error) {
        console.error(`Error updating table: ${error.message}`);
        return createErrorResponse(`Error updating table: ${error.message}`);
      }
    }
  );

  // Delete table
  server.tool(
    "xano_delete_table",
    {
      instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
      workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
      table_id: z.union([z.string(), z.number()]).describe("The ID of the table to delete")
    },
    async ({ instance_name, workspace_id, table_id }) => {
      const auth = checkAuthentication(props);
      if (!auth.isAuthenticated || auth.errorContent) {
        return { content: auth.errorContent };
      }

      try {
        const url = getTableApiPath(instance_name, workspace_id, table_id);
        const result = await makeApiRequest(url, auth.apiKey, "DELETE");

        if (result.error) {
          return createErrorResponse(result.error);
        }

        return createSuccessResponse(result);
      } catch (error) {
        console.error(`Error deleting table: ${error.message}`);
        return createErrorResponse(`Error deleting table: ${error.message}`);
      }
    }
  );
}

/**
 * Registers schema management tools with the MCP server
 */
export function registerSchemaTools(server: McpServer, props: any) {
  // Add field to schema
  server.tool(
    "xano_add_field_to_schema",
    {
      instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
      workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
      table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
      field_name: z.string().describe("The name of the new field"),
      field_type: z.string().describe("The type of the field (e.g., \"text\", \"int\", \"decimal\", \"boolean\", \"date\")"),
      description: z.string().optional().describe("Field description"),
      nullable: z.boolean().optional().describe("Whether the field can be null"),
      default: z.any().optional().describe("Default value for the field"),
      required: z.boolean().optional().describe("Whether the field is required"),
      access: z.string().optional().describe("Field access level (\"public\", \"private\", \"internal\")"),
      sensitive: z.boolean().optional().describe("Whether the field contains sensitive data"),
      style: z.string().optional().describe("Field style (\"single\" or \"list\")"),
      validators: z.record(z.any()).optional().describe("Validation rules specific to the field type")
    },
    async ({ 
      instance_name, workspace_id, table_id, field_name, field_type,
      description, nullable, default: defaultValue, required, access, sensitive, style, validators
    }) => {
      const auth = checkAuthentication(props);
      if (!auth.isAuthenticated || auth.errorContent) {
        return { content: auth.errorContent };
      }

      try {
        const url = getSchemaApiPath(instance_name, workspace_id, table_id);
        
        const data = {
          name: field_name,
          type: field_type,
          description: description || "",
          nullable: nullable !== undefined ? nullable : false,
          default: defaultValue,
          required: required !== undefined ? required : false,
          access: access || "public",
          sensitive: sensitive !== undefined ? sensitive : false,
          style: style || "single",
          validators: validators || null
        };
        
        const result = await makeApiRequest(url, auth.apiKey, "POST", data);

        if (result.error) {
          return createErrorResponse(result.error);
        }

        return createSuccessResponse(result);
      } catch (error) {
        console.error(`Error adding field to schema: ${error.message}`);
        return createErrorResponse(`Error adding field to schema: ${error.message}`);
      }
    }
  );

  // Rename schema field
  server.tool(
    "xano_rename_schema_field",
    {
      instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
      workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
      table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
      old_name: z.string().describe("The current name of the field"),
      new_name: z.string().describe("The new name for the field")
    },
    async ({ instance_name, workspace_id, table_id, old_name, new_name }) => {
      const auth = checkAuthentication(props);
      if (!auth.isAuthenticated || auth.errorContent) {
        return { content: auth.errorContent };
      }

      try {
        const url = `${getSchemaApiPath(instance_name, workspace_id, table_id)}/${old_name}/rename`;
        
        const data = {
          new_name: new_name
        };
        
        const result = await makeApiRequest(url, auth.apiKey, "PUT", data);

        if (result.error) {
          return createErrorResponse(result.error);
        }

        return createSuccessResponse(result);
      } catch (error) {
        console.error(`Error renaming schema field: ${error.message}`);
        return createErrorResponse(`Error renaming schema field: ${error.message}`);
      }
    }
  );

  // Delete field
  server.tool(
    "xano_delete_field",
    {
      instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
      workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
      table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
      field_name: z.string().describe("The name of the field to delete")
    },
    async ({ instance_name, workspace_id, table_id, field_name }) => {
      const auth = checkAuthentication(props);
      if (!auth.isAuthenticated || auth.errorContent) {
        return { content: auth.errorContent };
      }

      try {
        const url = `${getSchemaApiPath(instance_name, workspace_id, table_id)}/${field_name}`;
        
        const result = await makeApiRequest(url, auth.apiKey, "DELETE");

        if (result.error) {
          return createErrorResponse(result.error);
        }

        return createSuccessResponse(result);
      } catch (error) {
        console.error(`Error deleting field: ${error.message}`);
        return createErrorResponse(`Error deleting field: ${error.message}`);
      }
    }
  );
}

/**
 * Registers record management tools with the MCP server
 */
export function registerRecordTools(server: McpServer, props: any) {
  // Browse table content
  server.tool(
    "xano_browse_table_content",
    {
      instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
      workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
      table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
      page: z.number().optional().describe("Page number (default: 1)"),
      per_page: z.number().optional().describe("Number of records per page (default: 50)")
    },
    async ({ instance_name, workspace_id, table_id, page, per_page }) => {
      const auth = checkAuthentication(props);
      if (!auth.isAuthenticated || auth.errorContent) {
        return { content: auth.errorContent };
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
          return createErrorResponse(result.error);
        }

        return createSuccessResponse(result);
      } catch (error) {
        console.error(`Error browsing table content: ${error.message}`);
        return createErrorResponse(`Error browsing table content: ${error.message}`);
      }
    }
  );

  // Search table content
  server.tool(
    "xano_search_table_content",
    {
      instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
      workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
      table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
      search_conditions: z.array(z.record(z.any())).optional().describe("List of search conditions"),
      sort: z.record(z.string()).optional().describe("Dictionary with field names as keys and \"asc\" or \"desc\" as values"),
      page: z.number().optional().describe("Page number (default: 1)"),
      per_page: z.number().optional().describe("Number of records per page (default: 50)")
    },
    async ({ instance_name, workspace_id, table_id, search_conditions, sort, page, per_page }) => {
      const auth = checkAuthentication(props);
      if (!auth.isAuthenticated || auth.errorContent) {
        return { content: auth.errorContent };
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
          return createErrorResponse(result.error);
        }

        return createSuccessResponse(result);
      } catch (error) {
        console.error(`Error searching table content: ${error.message}`);
        return createErrorResponse(`Error searching table content: ${error.message}`);
      }
    }
  );

  // Get table record
  server.tool(
    "xano_get_table_record",
    {
      instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
      workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
      table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
      record_id: z.union([z.string(), z.number()]).describe("The ID of the record to retrieve")
    },
    async ({ instance_name, workspace_id, table_id, record_id }) => {
      const auth = checkAuthentication(props);
      if (!auth.isAuthenticated || auth.errorContent) {
        return { content: auth.errorContent };
      }

      try {
        const url = getRecordsApiPath(instance_name, workspace_id, table_id, record_id);
        const result = await makeApiRequest(url, auth.apiKey);

        if (result.error) {
          return createErrorResponse(result.error);
        }

        return createSuccessResponse(result);
      } catch (error) {
        console.error(`Error getting table record: ${error.message}`);
        return createErrorResponse(`Error getting table record: ${error.message}`);
      }
    }
  );

  // Create table record
  server.tool(
    "xano_create_table_record",
    {
      instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
      workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
      table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
      record_data: z.record(z.any()).describe("The data for the new record")
    },
    async ({ instance_name, workspace_id, table_id, record_data }) => {
      const auth = checkAuthentication(props);
      if (!auth.isAuthenticated || auth.errorContent) {
        return { content: auth.errorContent };
      }

      try {
        const url = getRecordsApiPath(instance_name, workspace_id, table_id);
        const result = await makeApiRequest(url, auth.apiKey, "POST", record_data);

        if (result.error) {
          return createErrorResponse(result.error);
        }

        return createSuccessResponse(result);
      } catch (error) {
        console.error(`Error creating table record: ${error.message}`);
        return createErrorResponse(`Error creating table record: ${error.message}`);
      }
    }
  );

  // Update table record
  server.tool(
    "xano_update_table_record",
    {
      instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
      workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
      table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
      record_id: z.union([z.string(), z.number()]).describe("The ID of the record to update"),
      record_data: z.record(z.any()).describe("The updated data for the record")
    },
    async ({ instance_name, workspace_id, table_id, record_id, record_data }) => {
      const auth = checkAuthentication(props);
      if (!auth.isAuthenticated || auth.errorContent) {
        return { content: auth.errorContent };
      }

      try {
        const url = getRecordsApiPath(instance_name, workspace_id, table_id, record_id);
        const result = await makeApiRequest(url, auth.apiKey, "PUT", record_data);

        if (result.error) {
          return createErrorResponse(result.error);
        }

        return createSuccessResponse(result);
      } catch (error) {
        console.error(`Error updating table record: ${error.message}`);
        return createErrorResponse(`Error updating table record: ${error.message}`);
      }
    }
  );

  // Delete table record
  server.tool(
    "xano_delete_table_record",
    {
      instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
      workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
      table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
      record_id: z.union([z.string(), z.number()]).describe("The ID of the record to delete")
    },
    async ({ instance_name, workspace_id, table_id, record_id }) => {
      const auth = checkAuthentication(props);
      if (!auth.isAuthenticated || auth.errorContent) {
        return { content: auth.errorContent };
      }

      try {
        const url = getRecordsApiPath(instance_name, workspace_id, table_id, record_id);
        const result = await makeApiRequest(url, auth.apiKey, "DELETE");

        if (result.error) {
          return createErrorResponse(result.error);
        }

        return createSuccessResponse(result);
      } catch (error) {
        console.error(`Error deleting table record: ${error.message}`);
        return createErrorResponse(`Error deleting table record: ${error.message}`);
      }
    }
  );
}

/**
 * Registers bulk operations tools with the MCP server
 */
export function registerBulkTools(server: McpServer, props: any) {
  // Bulk create records
  server.tool(
    "xano_bulk_create_records",
    {
      instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
      workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
      table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
      records: z.array(z.record(z.any())).describe("List of record data to insert"),
      allow_id_field: z.boolean().optional().describe("Whether to allow setting the ID field")
    },
    async ({ instance_name, workspace_id, table_id, records, allow_id_field }) => {
      const auth = checkAuthentication(props);
      if (!auth.isAuthenticated || auth.errorContent) {
        return { content: auth.errorContent };
      }

      try {
        const url = `${getRecordsApiPath(instance_name, workspace_id, table_id)}/bulk`;
        
        const data = {
          records,
          allow_id_field: allow_id_field || false
        };
        
        const result = await makeApiRequest(url, auth.apiKey, "POST", data);

        if (result.error) {
          return createErrorResponse(result.error);
        }

        return createSuccessResponse(result);
      } catch (error) {
        console.error(`Error bulk creating records: ${error.message}`);
        return createErrorResponse(`Error bulk creating records: ${error.message}`);
      }
    }
  );
}

/**
 * Integrates all tools with the MyMCP class
 */
export function integrateAllTools(server: McpServer, props: any) {
  registerTableTools(server, props);
  registerSchemaTools(server, props);
  registerRecordTools(server, props);
  registerBulkTools(server, props);
  
  // Additional categories can be added here as they are implemented
}