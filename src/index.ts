import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { XanoHandler } from "./xano-handler";
import { makeApiRequest, getMetaApiUrl, formatId, Props } from "./utils";

// Use the Props type from utils.ts as XanoAuthProps
export type XanoAuthProps = Props;

// Define MCP agent for Xano
export class MyMCP extends McpAgent<Env, unknown, XanoAuthProps> {
  server = new McpServer({
    name: "Snappy MCP Server",
    version: "1.0.0",
  });

  async init() {
    // Debug tool to see what props are available
    this.server.tool(
      "debug_auth",
      {},
      async () => {
        console.log("DEBUG_AUTH TOOL CALLED", {
          hasProps: !!this.props,
          authenticated: this.props?.authenticated,
          hasApiKey: !!this.props?.apiKey,
          apiKeyType: this.props?.apiKey ? typeof this.props.apiKey : 'undefined',
          apiKeyLength: this.props?.apiKey ? this.props.apiKey.length : 0
        });

        return {
          content: [{
            type: "text",
            text: "Auth debug info: " + JSON.stringify({
              apiKey: !!this.props?.apiKey,
              apiKeyPrefix: this.props?.apiKey ? this.props.apiKey.substring(0, 20) + "..." : null,
              apiKeyType: this.props?.apiKey ? typeof this.props.apiKey : 'undefined',
              apiKeyLength: this.props?.apiKey ? this.props.apiKey.length : 0,
              userId: this.props?.userId,
              name: this.props?.name,
              email: this.props?.email,
              authenticated: this.props?.authenticated
            }, null, 2)
          }]
        };
      }
    );

    // User info tool
    this.server.tool(
      "whoami",
      {},
      async () => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Not authenticated" }]
          };
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              userId: this.props.userId,
              name: this.props.userDetails?.name,
              authenticated: true
            }, null, 2)
          }]
        };
      }
    );

    // Register hello tool
    this.server.tool(
      "hello",
      { name: z.string() },
      async ({ name }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        return {
          content: [{ type: "text", text: `Hello, ${name}! You are authenticated as ${this.props.userId}.` }]
        };
      }
    );

    // List Xano instances
    this.server.tool(
      "xano_list_instances",
      {},
      async () => {
        // Check authentication
        console.log("xano_list_instances called", {
          authenticated: this.props?.authenticated,
          hasApiKey: !!this.props?.apiKey
        });

        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from props
        const token = this.props.apiKey;

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const url = "https://app.xano.com/api:meta/instance";
          const result = await makeApiRequest(url, token);

          if (result.error) {
            return {
              content: [{ type: "text", text: `Error: ${result.error}` }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({ instances: result })
            }]
          };
        } catch (error) {
          console.error(`Error listing instances: ${error.message}`);
          return {
            content: [{
              type: "text",
              text: `Error listing instances: ${error.message}`
            }]
          };
        }
      }
    );

    // Get instance details
    this.server.tool(
      "xano_get_instance_details",
      {
        instance_name: z.string().describe("The name of the Xano instance")
      },
      async ({ instance_name }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        try {
          // Construct instance details
          const instanceDomain = `${instance_name}.n7c.xano.io`;
          const details = {
            name: instance_name,
            display: instance_name.split("-")[0].toUpperCase(),
            xano_domain: instanceDomain,
            rate_limit: false,
            meta_api: `https://${instanceDomain}/api:meta`,
            meta_swagger: `https://${instanceDomain}/apispec:meta?type=json`,
          };

          return {
            content: [{
              type: "text",
              text: JSON.stringify(details)
            }]
          };
        } catch (error) {
          console.error(`Error getting instance details: ${error.message}`);
          return {
            content: [{
              type: "text",
              text: `Error getting instance details: ${error.message}`
            }]
          };
        }
      }
    );

    // List databases
    this.server.tool(
      "xano_list_databases",
      {
        instance_name: z.string().describe("The name of the Xano instance")
      },
      async ({ instance_name }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from props
        const token = this.props.apiKey;

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace`;
          const result = await makeApiRequest(url, token);

          if (result.error) {
            return {
              content: [{ type: "text", text: `Error: ${result.error}` }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({ databases: result })
            }]
          };
        } catch (error) {
          console.error(`Error listing databases: ${error.message}`);
          return {
            content: [{
              type: "text",
              text: `Error listing databases: ${error.message}`
            }]
          };
        }
      }
    );

    // Get workspace details
    this.server.tool(
      "xano_get_workspace_details",
      {
        instance_name: z.string().describe("The name of the Xano instance"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace")
      },
      async ({ instance_name, workspace_id }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from props
        const token = this.props.apiKey;

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}`;
          const result = await makeApiRequest(url, token);

          if (result.error) {
            return {
              content: [{ type: "text", text: `Error: ${result.error}` }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify(result)
            }]
          };
        } catch (error) {
          console.error(`Error getting workspace details: ${error.message}`);
          return {
            content: [{
              type: "text",
              text: `Error getting workspace details: ${error.message}`
            }]
          };
        }
      }
    );

    // List tables
    this.server.tool(
      "xano_list_tables",
      {
        instance_name: z.string().describe("The name of the Xano instance"),
        database_id: z.union([z.string(), z.number()]).describe("The ID of the Xano workspace/database")
      },
      async ({ instance_name, database_id }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from props
        const token = this.props.apiKey;

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(database_id)}/table`;
          const result = await makeApiRequest(url, token);

          if (result.error) {
            return {
              content: [{ type: "text", text: `Error: ${result.error}` }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({ tables: result })
            }]
          };
        } catch (error) {
          console.error(`Error listing tables: ${error.message}`);
          return {
            content: [{
              type: "text",
              text: `Error listing tables: ${error.message}`
            }]
          };
        }
      }
    );

    // NEW TOOLS ADDED BELOW
    // ======================

    // Get table details
    this.server.tool(
      "xano_get_table_details",
      {
        instance_name: z.string().describe("The name of the Xano instance"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
        table_id: z.union([z.string(), z.number()]).describe("The ID of the table")
      },
      async ({ instance_name, workspace_id, table_id }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from props
        const token = this.props.apiKey;

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}`;
          const result = await makeApiRequest(url, token);

          if (result.error) {
            return {
              content: [{ type: "text", text: `Error: ${result.error}` }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify(result)
            }]
          };
        } catch (error) {
          console.error(`Error getting table details: ${error.message}`);
          return {
            content: [{
              type: "text",
              text: `Error getting table details: ${error.message}`
            }]
          };
        }
      }
    );

    // Get table schema
    this.server.tool(
      "xano_get_table_schema",
      {
        instance_name: z.string().describe("The name of the Xano instance"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
        table_id: z.union([z.string(), z.number()]).describe("The ID of the table")
      },
      async ({ instance_name, workspace_id, table_id }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from props
        const token = this.props.apiKey;

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/schema`;
          const result = await makeApiRequest(url, token);

          if (result.error) {
            return {
              content: [{ type: "text", text: `Error: ${result.error}` }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({ schema: result })
            }]
          };
        } catch (error) {
          console.error(`Error getting table schema: ${error.message}`);
          return {
            content: [{
              type: "text",
              text: `Error getting table schema: ${error.message}`
            }]
          };
        }
      }
    );

    // Create table
    this.server.tool(
      "xano_create_table",
      {
        instance_name: z.string().describe("The name of the Xano instance"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
        name: z.string().describe("The name of the new table"),
        description: z.string().optional().describe("Table description"),
        docs: z.string().optional().describe("Documentation text"),
        auth: z.boolean().optional().describe("Whether authentication is required"),
        tag: z.array(z.string()).optional().describe("List of tags for the table")
      },
      async ({ instance_name, workspace_id, name, description, docs, auth, tag }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from props
        const token = this.props.apiKey;

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table`;
          
          const data = {
            name,
            description: description || "",
            docs: docs || "",
            auth: auth || false,
            tag: tag || []
          };
          
          const result = await makeApiRequest(url, token, "POST", data);

          if (result.error) {
            return {
              content: [{ type: "text", text: `Error: ${result.error}` }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify(result)
            }]
          };
        } catch (error) {
          console.error(`Error creating table: ${error.message}`);
          return {
            content: [{
              type: "text",
              text: `Error creating table: ${error.message}`
            }]
          };
        }
      }
    );

    // Update table
    this.server.tool(
      "xano_update_table",
      {
        instance_name: z.string().describe("The name of the Xano instance"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
        table_id: z.union([z.string(), z.number()]).describe("The ID of the table to update"),
        name: z.string().optional().describe("The new name of the table"),
        description: z.string().optional().describe("New table description"),
        docs: z.string().optional().describe("New documentation text"),
        auth: z.boolean().optional().describe("New authentication setting"),
        tag: z.array(z.string()).optional().describe("New list of tags for the table")
      },
      async ({ instance_name, workspace_id, table_id, name, description, docs, auth, tag }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from props
        const token = this.props.apiKey;

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/meta`;
          
          // Only include fields that are provided
          const data: any = {};
          if (name !== undefined) data.name = name;
          if (description !== undefined) data.description = description;
          if (docs !== undefined) data.docs = docs;
          if (auth !== undefined) data.auth = auth;
          if (tag !== undefined) data.tag = tag;
          
          console.log("Updating table with:", JSON.stringify(data, null, 2));
          
          const result = await makeApiRequest(url, token, "PUT", data);

          // Handle response including null/empty responses
          if (result && result.error) {
            return {
              content: [{ type: "text", text: `Error: ${result.error}` }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify(result || { success: true, message: "Table updated successfully" })
            }]
          };
        } catch (error) {
          console.error(`Error updating table: ${error.message}`);
          return {
            content: [{
              type: "text",
              text: `Error updating table: ${error.message}`
            }]
          };
        }
      }
    );

    // Delete table
    this.server.tool(
      "xano_delete_table",
      {
        instance_name: z.string().describe("The name of the Xano instance"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
        table_id: z.union([z.string(), z.number()]).describe("The ID of the table to delete")
      },
      async ({ instance_name, workspace_id, table_id }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from props
        const token = this.props.apiKey;

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}`;
          
          console.log(`Deleting table ${table_id} from workspace ${workspace_id}`);
          
          const result = await makeApiRequest(url, token, "DELETE");

          // Null or empty response is common for successful DELETE operations
          // First check if result exists and has an error property
          if (result && result.error) {
            return {
              content: [{ type: "text", text: `Error: ${result.error}` }]
            };
          }
          
          // If we reach here, the deletion was likely successful
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ success: true, message: "Table deleted successfully" })
            }]
          };
        } catch (error) {
          console.error(`Error deleting table: ${error.message}`);
          return {
            content: [{
              type: "text",
              text: `Error deleting table: ${error.message}`
            }]
          };
        }
      }
    );

    // Add field to schema
    this.server.tool(
      "xano_add_field_to_schema",
      {
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
      async ({ 
        instance_name, workspace_id, table_id, field_name, field_type,
        description, nullable, default_value, required, access, sensitive, style, validators
      }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from props
        const token = this.props.apiKey;

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const schemaUrl = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/schema`;
          
          // First get the current schema
          const currentSchemaResult = await makeApiRequest(schemaUrl, token);
          
          if (currentSchemaResult.error) {
            return {
              content: [{ type: "text", text: `Error getting current schema: ${currentSchemaResult.error}` }]
            };
          }
          
          // Create the new field
          const newField = {
            name: field_name,
            type: field_type,
            description: description || "",
            nullable: nullable !== undefined ? nullable : true,
            required: required !== undefined ? required : false,
            access: access || "public",
            sensitive: sensitive !== undefined ? sensitive : false,
            style: style || "single"
          };
          
          // Add default value if provided
          if (default_value !== undefined) {
            newField["default"] = default_value;
          }
          
          // Add validators if provided
          if (validators) {
            newField["validators"] = validators;
          }
          
          // Get current schema 
          const currentSchema = currentSchemaResult.schema || [];
          
          console.log("Current schema:", JSON.stringify(currentSchema, null, 2));
          
          // Carefully handle the schema to ensure primary key remains first
          // and all existing field structure is preserved
          
          // First, let's examine the schema closely
          if (currentSchema.length === 0) {
            console.error("Schema appears to be empty, which is unexpected");
            return {
              content: [{ type: "text", text: "Error: Cannot modify empty schema" }]
            };
          }
          
          // Find primary key field and verify it's first
          const firstField = currentSchema[0];
          if (firstField.name !== "id") {
            console.error("Primary key is not the first field in schema", firstField);
            return {
              content: [{ type: "text", text: "Error: Schema structure is invalid - primary key should be first" }]
            };
          }
          
          // Create a new schema array with primary key first, then all other existing fields, then new field
          const updatedSchema = [
            currentSchema[0], // Primary key (id) field
            ...currentSchema.slice(1),  // All other existing fields
            newField           // The new field we're adding
          ];
          
          // Double-check that primary key is still first
          if (updatedSchema[0].name !== "id") {
            console.error("Error: Primary key not preserved as first field");
            return {
              content: [{ type: "text", text: "Error: Failed to maintain schema structure" }]
            };
          }
          
          // Prepare data for updating schema
          const data = { schema: updatedSchema };
          
          console.log("Updating schema with:", JSON.stringify(data, null, 2));
          
          // Update the schema
          const result = await makeApiRequest(schemaUrl, token, "PUT", data);

          if (result.error) {
            return {
              content: [{ type: "text", text: `Error: ${result.error}` }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify(result)
            }]
          };
        } catch (error) {
          console.error(`Error adding field to schema: ${error.message}`);
          return {
            content: [{
              type: "text",
              text: `Error adding field to schema: ${error.message}`
            }]
          };
        }
      }
    );

    // Rename schema field
    this.server.tool(
      "xano_rename_schema_field",
      {
        instance_name: z.string().describe("The name of the Xano instance"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
        table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
        old_name: z.string().describe("The current name of the field"),
        new_name: z.string().describe("The new name for the field")
      },
      async ({ instance_name, workspace_id, table_id, old_name, new_name }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from props
        const token = this.props.apiKey;

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/schema/${old_name}/rename`;
          
          const data = {
            new_name: new_name
          };
          
          const result = await makeApiRequest(url, token, "PUT", data);

          if (result.error) {
            return {
              content: [{ type: "text", text: `Error: ${result.error}` }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify(result)
            }]
          };
        } catch (error) {
          console.error(`Error renaming schema field: ${error.message}`);
          return {
            content: [{
              type: "text",
              text: `Error renaming schema field: ${error.message}`
            }]
          };
        }
      }
    );

    // Delete field
    this.server.tool(
      "xano_delete_field",
      {
        instance_name: z.string().describe("The name of the Xano instance"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
        table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
        field_name: z.string().describe("The name of the field to delete")
      },
      async ({ instance_name, workspace_id, table_id, field_name }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from props
        const token = this.props.apiKey;

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/schema/${field_name}`;
          
          const result = await makeApiRequest(url, token, "DELETE");

          if (result.error) {
            return {
              content: [{ type: "text", text: `Error: ${result.error}` }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify(result)
            }]
          };
        } catch (error) {
          console.error(`Error deleting field: ${error.message}`);
          return {
            content: [{
              type: "text",
              text: `Error deleting field: ${error.message}`
            }]
          };
        }
      }
    );

    // Browse table content
    this.server.tool(
      "xano_browse_table_content",
      {
        instance_name: z.string().describe("The name of the Xano instance"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
        table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
        page: z.number().optional().describe("Page number (default: 1)"),
        per_page: z.number().optional().describe("Number of records per page (default: 50)")
      },
      async ({ instance_name, workspace_id, table_id, page, per_page }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from props
        const token = this.props.apiKey;

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const baseUrl = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/content`;
          
          // Add pagination parameters to URL
          const params = new URLSearchParams();
          if (page !== undefined) params.append('page', page.toString());
          if (per_page !== undefined) params.append('per_page', per_page.toString());
          
          const url = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
          const result = await makeApiRequest(url, token);

          if (result.error) {
            return {
              content: [{ type: "text", text: `Error: ${result.error}` }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify(result)
            }]
          };
        } catch (error) {
          console.error(`Error browsing table content: ${error.message}`);
          return {
            content: [{
              type: "text",
              text: `Error browsing table content: ${error.message}`
            }]
          };
        }
      }
    );

    // Search table content tool removed - causing Claude to crash

    // Get table record
    this.server.tool(
      "xano_get_table_record",
      {
        instance_name: z.string().describe("The name of the Xano instance"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
        table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
        record_id: z.union([z.string(), z.number()]).describe("The ID of the record to retrieve")
      },
      async ({ instance_name, workspace_id, table_id, record_id }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from props
        const token = this.props.apiKey;

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/content/${formatId(record_id)}`;
          const result = await makeApiRequest(url, token);

          if (result.error) {
            return {
              content: [{ type: "text", text: `Error: ${result.error}` }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify(result)
            }]
          };
        } catch (error) {
          console.error(`Error getting table record: ${error.message}`);
          return {
            content: [{
              type: "text",
              text: `Error getting table record: ${error.message}`
            }]
          };
        }
      }
    );

    // Create table record
    this.server.tool(
      "xano_create_table_record",
      {
        instance_name: z.string().describe("The name of the Xano instance"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
        table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
        record_data: z.record(z.any()).describe("The data for the new record")
      },
      async ({ instance_name, workspace_id, table_id, record_data }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from props
        const token = this.props.apiKey;

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/content`;
          const result = await makeApiRequest(url, token, "POST", record_data);

          if (result.error) {
            return {
              content: [{ type: "text", text: `Error: ${result.error}` }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify(result)
            }]
          };
        } catch (error) {
          console.error(`Error creating table record: ${error.message}`);
          return {
            content: [{
              type: "text",
              text: `Error creating table record: ${error.message}`
            }]
          };
        }
      }
    );

    // Update table record
    this.server.tool(
      "xano_update_table_record",
      {
        instance_name: z.string().describe("The name of the Xano instance"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
        table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
        record_id: z.union([z.string(), z.number()]).describe("The ID of the record to update"),
        record_data: z.record(z.any()).describe("The updated data for the record")
      },
      async ({ instance_name, workspace_id, table_id, record_id, record_data }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from props
        const token = this.props.apiKey;

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/content/${formatId(record_id)}`;
          const result = await makeApiRequest(url, token, "PUT", record_data);

          if (result.error) {
            return {
              content: [{ type: "text", text: `Error: ${result.error}` }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify(result)
            }]
          };
        } catch (error) {
          console.error(`Error updating table record: ${error.message}`);
          return {
            content: [{
              type: "text",
              text: `Error updating table record: ${error.message}`
            }]
          };
        }
      }
    );

    // Delete table record
    this.server.tool(
      "xano_delete_table_record",
      {
        instance_name: z.string().describe("The name of the Xano instance"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
        table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
        record_id: z.union([z.string(), z.number()]).describe("The ID of the record to delete")
      },
      async ({ instance_name, workspace_id, table_id, record_id }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from props
        const token = this.props.apiKey;

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/content/${formatId(record_id)}`;
          
          console.log(`Deleting record: ${record_id} from table ${table_id}`);
          
          const result = await makeApiRequest(url, token, "DELETE");

          // Handle response including null/empty responses which are common for DELETE operations
          if (result && result.error) {
            return {
              content: [{ type: "text", text: `Error: ${result.error}` }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify(result || { success: true, message: "Record deleted successfully" })
            }]
          };
        } catch (error) {
          console.error(`Error deleting table record: ${error.message}`);
          return {
            content: [{
              type: "text",
              text: `Error deleting table record: ${error.message}`
            }]
          };
        }
      }
    );

    // Bulk create records
    this.server.tool(
      "xano_bulk_create_records",
      {
        instance_name: z.string().describe("The name of the Xano instance"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
        table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
        records: z.array(z.record(z.any())).describe("List of record data to insert"),
        allow_id_field: z.boolean().optional().describe("Whether to allow setting the ID field")
      },
      async ({ instance_name, workspace_id, table_id, records, allow_id_field }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from props
        const token = this.props.apiKey;

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/content/bulk`;
          
          const data = {
            records,
            allow_id_field: allow_id_field || false
          };
          
          const result = await makeApiRequest(url, token, "POST", data);

          if (result.error) {
            return {
              content: [{ type: "text", text: `Error: ${result.error}` }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify(result)
            }]
          };
        } catch (error) {
          console.error(`Error bulk creating records: ${error.message}`);
          return {
            content: [{
              type: "text",
              text: `Error bulk creating records: ${error.message}`
            }]
          };
        }
      }
    );

    // Bulk update records
    this.server.tool(
      "xano_bulk_update_records",
      {
        instance_name: z.string().describe("The name of the Xano instance"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
        table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
        updates: z.array(z.object({
          row_id: z.union([z.string(), z.number()]),
          updates: z.record(z.any())
        })).describe("List of update operations, each containing row_id and updates")
      },
      async ({ instance_name, workspace_id, table_id, updates }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from props
        const token = this.props.apiKey;

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/content/bulk`;
          
          const result = await makeApiRequest(url, token, "PUT", { updates });

          if (result.error) {
            return {
              content: [{ type: "text", text: `Error: ${result.error}` }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify(result)
            }]
          };
        } catch (error) {
          console.error(`Error bulk updating records: ${error.message}`);
          return {
            content: [{
              type: "text",
              text: `Error bulk updating records: ${error.message}`
            }]
          };
        }
      }
    );
  }
}

// Create a new OAuthProvider instance following the GitHub pattern exactly
export default new OAuthProvider({
  kvNamespace: "OAUTH_KV",
  apiRoute: "/sse",
  apiHandler: MyMCP.mount("/sse"),
  defaultHandler: XanoHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  // Set these values to improve compatibility with OAuth clients
  forceHTTPS: true,
  refreshEndpoint: "/refresh",
  // Client lookup function to validate OAuth clients
  lookupClient: async (clientId) => {
    console.log("Client lookup called with ID:", clientId);

    // Accept any client ID and return a valid client with that ID
    // This matches the GitHub pattern and preserves the client ID throughout the flow
    const validClientId = clientId || "playground-client";

    return {
      id: validClientId,
      name: "Snappy MCP Client",
      redirectURIs: [
        "https://playground.ai.cloudflare.com/oauth/callback",
        "http://localhost:8080/callback",
        "http://localhost:8788/callback",
        "*" // Wildcard to accept any redirect URI for testing
      ]
    };
  }
});

// Environment type
export interface Env {
  MCP_OBJECT: DurableObjectNamespace;
  OAUTH_KV: KVNamespace;
  XANO_BASE_URL: string;
  COOKIE_ENCRYPTION_KEY: string;
}