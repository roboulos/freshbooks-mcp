import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { XanoHandler } from "./xano-handler";
import { makeApiRequest, getMetaApiUrl, formatId } from "./utils";

// Authentication properties interface - includes all the data we want to store about the authenticated user
export type XanoAuthProps = {
  apiKey: string;
  userId: string;
  authenticated: boolean;
  userDetails?: {
    name?: string;
    email?: string;
  };
};

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
          hasApiKey: !!this.props?.apiKey
        });

        return {
          content: [{
            type: "text",
            text: "Auth debug info: " + JSON.stringify({
              apiKey: !!this.props?.apiKey,
              apiKeyPrefix: this.props?.apiKey ? this.props.apiKey.substring(0, 10) + "..." : null,
              userId: this.props?.userId,
              authenticated: this.props?.authenticated,
              userDetails: this.props?.userDetails
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
  }
}

// Create a new OAuthProvider instance with the correct pattern
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
  // Make the OAuth provider more permissive with client validation
  autoApproveAllClients: true,
  // This implements client validation for OAuth token exchange
  // For token exchange, we need to accept any client ID that's presented
  lookupClient: async (clientId) => {
    console.log("Client lookup called with ID:", clientId);

    // The key fix: Always use the same client ID for validation
    // This forces the CloudFlare OAuth provider to accept the client
    // during token exchange, preventing the "Client ID mismatch" error
    const knownClientId = "xXjCNLDsDV4VB2nG"; // Default playground client ID

    // If this is a token exchange request, we want to match the client ID
    // that was used during the authorization request
    const useClientId = clientId || knownClientId;

    console.log("Using client ID for validation:", useClientId);

    // Return a valid client with the appropriate redirect URIs
    return {
      id: useClientId, // IMPORTANT: Return the SAME client ID that was provided
      name: "Xano MCP Client",
      // Include all possible redirect URIs to ensure validation
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
}