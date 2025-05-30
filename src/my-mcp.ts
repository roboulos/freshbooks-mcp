import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, getMetaApiUrl, formatId } from "./utils";

// Interface for authentication properties
export interface AuthProps {
  apiKey?: string;
  userId?: string;
  authenticated?: boolean;
  user?: {
    id: string;
    authenticated: boolean;
    apiKey?: string;
  };
  [key: string]: unknown; // For compatibility with McpAgent
}

// MCP Agent implementation with Xano tools
export class MyMCP extends McpAgent<Env, unknown, AuthProps> {
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
        return {
          content: [{ 
            type: "text", 
            text: "Auth debug info: " + JSON.stringify({
              // Check both user and direct props structure
              hasUser: !!this.props?.user,
              userKeys: this.props?.user ? Object.keys(this.props.user) : null,
              apiKey: this.props?.apiKey || this.props?.user?.apiKey,
              userId: this.props?.userId || this.props?.user?.id,
              authenticated: this.props?.authenticated || this.props?.user?.authenticated,
              allProps: this.props
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
        // Check authentication using either direct props or user object
        if (!(this.props?.authenticated || this.props?.user?.authenticated)) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        const userId = this.props?.userId || this.props?.user?.id;
        return {
          content: [{ type: "text", text: `Hello, ${name}! You are authenticated as ${userId}.` }]
        };
      }
    );

    // List Xano instances
    this.server.tool(
      "xano_list_instances",
      {},
      async () => {
        // Check authentication using either direct props or user object
        if (!(this.props?.authenticated || this.props?.user?.authenticated)) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from either source
        const apiKey = this.props?.apiKey || this.props?.user?.apiKey;
        if (!apiKey) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const url = "https://app.xano.com/api:meta/instance";
          const result = await makeApiRequest(url, apiKey);

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
        instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')")
      },
      async ({ instance_name }) => {
        // Check authentication using either direct props or user object
        if (!(this.props?.authenticated || this.props?.user?.authenticated)) {
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
        instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')")
      },
      async ({ instance_name }) => {
        // Check authentication using either direct props or user object
        if (!(this.props?.authenticated || this.props?.user?.authenticated)) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from either source
        const apiKey = this.props?.apiKey || this.props?.user?.apiKey;
        if (!apiKey) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace`;
          const result = await makeApiRequest(url, apiKey);

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
        instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace")
      },
      async ({ instance_name, workspace_id }) => {
        // Check authentication using either direct props or user object
        if (!(this.props?.authenticated || this.props?.user?.authenticated)) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from either source
        const apiKey = this.props?.apiKey || this.props?.user?.apiKey;
        if (!apiKey) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}`;
          const result = await makeApiRequest(url, apiKey);

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
        instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
        database_id: z.union([z.string(), z.number()]).describe("The ID of the Xano workspace/database")
      },
      async ({ instance_name, database_id }) => {
        // Check authentication using either direct props or user object
        if (!(this.props?.authenticated || this.props?.user?.authenticated)) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use API key from either source
        const apiKey = this.props?.apiKey || this.props?.user?.apiKey;
        if (!apiKey) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(database_id)}/table`;
          const result = await makeApiRequest(url, apiKey);

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
  }
}

// For TypeScript
export interface Env {
  MCP_OBJECT: DurableObjectNamespace;
  OAUTH_KV: KVNamespace;
  XANO_BASE_URL: string;
  OAUTH_PROVIDER?: any;
}