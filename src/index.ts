import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { XanoHandler } from "./xano-handler";
import { makeApiRequest, getMetaApiUrl, formatId, Props } from "./utils";
import { refreshUserProfile } from "./refresh-profile";
import { MCPAuthMiddleware } from "./mcp-auth-middleware";
import { logUsage } from "./usage-logger";

// Use the Props type from utils.ts as XanoAuthProps
export type XanoAuthProps = Props;

// Define MCP agent for Xano
export class MyMCP extends McpAgent<Env, unknown, XanoAuthProps> {
  server = new McpServer({
    name: "Snappy MCP Server",
    version: "1.0.0",
  });
  
  private middleware?: MCPAuthMiddleware;
  
  // Override the onNewRequest method to handle requests with authentication refresh
  async onNewRequest(req: Request, env: Env): Promise<[Request, XanoAuthProps, unknown]> {
    // First call the parent method to get the default props
    const [request, props, ctx] = await super.onNewRequest(req, env);
    
    // Log the props we receive to better understand what's available
    console.log("PROPS IN ON_NEW_REQUEST:", {
      authenticated: props?.authenticated,
      hasAccessToken: !!props?.accessToken,
      accessTokenLength: props?.accessToken ? props.accessToken.length : 0,
      hasApiKey: !!props?.apiKey,
      apiKeyLength: props?.apiKey ? props.apiKey.length : 0,
      userId: props?.userId,
      propKeys: props ? Object.keys(props) : []
    });
    
    // If we're authenticated, check KV for the latest API key
    if (props?.authenticated && props?.userId) {
      try {
        // Look for the latest auth data in KV storage
        const authEntries = await env.OAUTH_KV.list({ prefix: 'xano_auth_token:' });
        
        if (authEntries.keys && authEntries.keys.length > 0) {
          const authDataStr = await env.OAUTH_KV.get(authEntries.keys[0].name);
          if (authDataStr) {
            const authData = JSON.parse(authDataStr);
            if (authData.userId === props.userId && authData.apiKey) {
              // Update props with fresh API key from KV
              const freshProps = {
                ...props,
                apiKey: authData.apiKey,
                lastRefreshed: authData.lastRefreshed
              };
              console.log("Updated props with fresh API key from KV");
              return [request, freshProps, ctx];
            }
          }
        }
        
        // Fallback: try token: prefix entries
        const tokenEntries = await env.OAUTH_KV.list({ prefix: 'token:' });
        for (const key of tokenEntries.keys || []) {
          const tokenDataStr = await env.OAUTH_KV.get(key.name);
          if (tokenDataStr) {
            const tokenData = JSON.parse(tokenDataStr);
            if (tokenData.userId === props.userId && tokenData.apiKey) {
              const freshProps = {
                ...props,
                apiKey: tokenData.apiKey,
                lastRefreshed: tokenData.lastRefreshed
              };
              console.log("Updated props with fresh API key from token KV");
              return [request, freshProps, ctx];
            }
          }
        }
      } catch (error) {
        console.error("Error fetching fresh API key from KV:", error);
        // Continue with original props if KV lookup fails
      }
    }
    
    return [request, props, ctx];
  }

  async getFreshApiKey(): Promise<string | null> {
    if (!this.props?.authenticated || !this.props?.userId) {
      return this.props?.apiKey || null;
    }

    try {
      // Look for the latest auth data in KV storage
      const authEntries = await this.env.OAUTH_KV.list({ prefix: 'xano_auth_token:' });
      
      if (authEntries.keys && authEntries.keys.length > 0) {
        const authDataStr = await this.env.OAUTH_KV.get(authEntries.keys[0].name);
        if (authDataStr) {
          const authData = JSON.parse(authDataStr);
          if (authData.userId === this.props.userId && authData.apiKey) {
            console.log("Using fresh API key from KV storage");
            return authData.apiKey;
          }
        }
      }
      
      // Fallback: try token: prefix entries
      const tokenEntries = await this.env.OAUTH_KV.list({ prefix: 'token:' });
      for (const key of tokenEntries.keys || []) {
        const tokenDataStr = await this.env.OAUTH_KV.get(key.name);
        if (tokenDataStr) {
          const tokenData = JSON.parse(tokenDataStr);
          if (tokenData.userId === this.props.userId && tokenData.apiKey) {
            console.log("Using fresh API key from token KV storage");
            return tokenData.apiKey;
          }
        }
      }
    } catch (error) {
      console.error("Error fetching fresh API key:", error);
    }
    
    // Fallback to cached props if KV lookup fails
    console.log("Falling back to cached API key from props");
    return this.props?.apiKey || null;
  }

  private getSessionInfo(): { sessionId: string; userId: string } | null {
    if (!this.props?.authenticated || !this.props?.userId) {
      return null;
    }
    
    // Generate a session ID if not available
    const sessionId = this.props.sessionId || `session-${this.props.userId}-${Date.now()}`;
    const userId = this.props.userId;
    
    return { sessionId, userId };
  }

  private logToolCall(toolName: string): void {
    const sessionInfo = this.getSessionInfo();
    if (sessionInfo) {
      logUsage('tool_executed', {
        userId: sessionInfo.userId,
        sessionId: sessionInfo.sessionId,
        details: { tool: toolName },
        env: this.env
      });
    }
  }


  private wrapWithUsageLogging(toolName: string, handler: Function): Function {
    return async (...args: any[]) => {
      // Simple logging at the start
      this.logToolCall(toolName);
      
      // Execute the original handler
      return await handler(...args);
    };
  }

  async init() {
    // Initialize middleware for usage logging
    this.middleware = new MCPAuthMiddleware(undefined, undefined, this.env);
    
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

        const sessionInfo = this.getSessionInfo();

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
              authenticated: this.props?.authenticated,
              lastRefreshed: this.props?.lastRefreshed || "never",
              sessionInfo: sessionInfo,
              hasMiddleware: !!this.middleware
            }, null, 2)
          }]
        };
      }
    );
    
    // Tool to manually trigger a profile refresh
    // This tool is only for debugging purposes
    this.server.tool(
      "debug_refresh_profile",
      {},
      async () => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }
        
        try {
          // Call the refresh function
          const refreshResult = await refreshUserProfile(this.env);
          
          if (refreshResult.success) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: "Profile refreshed successfully",
                  profile: {
                    apiKeyPrefix: refreshResult.profile.apiKey.substring(0, 20) + "...",
                    userId: refreshResult.profile.userId,
                    name: refreshResult.profile.name,
                    email: refreshResult.profile.email
                  }
                }, null, 2)
              }]
            };
          } else {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: refreshResult.error
                }, null, 2)
              }]
            };
          }
        } catch (error) {
          console.error("Error refreshing profile:", error);
          return {
            content: [{
              type: "text",
              text: `Error refreshing profile: ${error.message || "Unknown error"}`
            }]
          };
        }
      }
    );
    
    // Tool to manually expire OAuth tokens for testing
    this.server.tool(
      "debug_expire_oauth_tokens",
      {},
      async () => {
        try {
          // Check authentication
          if (!this.props?.authenticated) {
            return {
              content: [{ type: "text", text: "Authentication required to use this tool." }]
            };
          }
          
          // List all token entries and manually expire them
          const tokenEntries = await this.env.OAUTH_KV.list({ prefix: 'token:' });
          const expiredCount = tokenEntries.keys?.length || 0;
          
          for (const key of tokenEntries.keys || []) {
            // Set expiration to 60 seconds from now (minimum allowed by Cloudflare KV)
            const tokenData = await this.env.OAUTH_KV.get(key.name);
            if (tokenData) {
              await this.env.OAUTH_KV.put(key.name, tokenData, { expirationTtl: 60 });
            }
          }
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Manually expired ${expiredCount} OAuth tokens`,
                note: "Tokens will expire in 60 seconds. Wait 1 minute, then try another MCP tool call to trigger OAuth re-authentication"
              }, null, 2)
            }]
          };
        } catch (error) {
          console.error("Error expiring OAuth tokens:", error);
          return {
            content: [{
              type: "text",
              text: `Error expiring OAuth tokens: ${error.message || "Unknown error"}`
            }]
          };
        }
      }
    );
    
    // Tool to examine the KV storage
    this.server.tool(
      "debug_kv_storage",
      {},
      async () => {
        try {
          // Check authentication
          if (!this.props?.authenticated) {
            return {
              content: [{ type: "text", text: "Authentication required to use this tool." }]
            };
          }
          
          // List all entries in KV storage
          const listResult = await this.env.OAUTH_KV.list();
          
          // Format results
          const keys = listResult.keys || [];
          const keyDetails = [];
          
          for (const key of keys) {
            const value = await this.env.OAUTH_KV.get(key.name);
            let parsedValue;
            
            try {
              parsedValue = JSON.parse(value);
            } catch (e) {
              parsedValue = { error: "Not valid JSON", length: value ? value.length : 0 };
            }
            
            keyDetails.push({
              name: key.name,
              expiration: key.expiration,
              metadata: key.metadata,
              value: parsedValue
            });
          }
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                keyCount: keys.length,
                keys: keyDetails,
                propsAccessToken: this.props?.accessToken ? this.props.accessToken.substring(0, 10) + "..." : null
              }, null, 2)
            }]
          };
        } catch (error) {
          console.error("Error examining KV storage:", error);
          return {
            content: [{
              type: "text",
              text: `Error examining KV storage: ${error.message || "Unknown error"}`
            }]
          };
        }
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
      this.wrapWithUsageLogging("xano_list_instances", async () => {
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

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const url = "https://app.xano.com/api:meta/instance";
          const result = await makeApiRequest(url, token, "GET", undefined, this.env);

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
      })
    );

    // Get instance details
    this.server.tool(
      "xano_get_instance_details",
      {
        instance_name: z.string().describe("The name of the Xano instance")
      },
      this.wrapWithUsageLogging("xano_get_instance_details", async ({ instance_name }) => {
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
      })
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

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace`;
          const result = await makeApiRequest(url, token, "GET", undefined, this.env);

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

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}`;
          const result = await makeApiRequest(url, token, "GET", undefined, this.env);

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

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(database_id)}/table`;
          const result = await makeApiRequest(url, token, "GET", undefined, this.env);

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

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}`;
          const result = await makeApiRequest(url, token, "GET", undefined, this.env);

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
      {
        annotations: {
          title: "Get Table Schema",
          readOnlyHint: true,     // This is just reading data
          destructiveHint: false, // No destructive changes
          idempotentHint: true,   // Same request always returns same result
          openWorldHint: true     // Interacts with external Xano API
        }
      },
      async ({ instance_name, workspace_id, table_id }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/schema`;
          const result = await makeApiRequest(url, token, "GET", undefined, this.env);

          if (result.error) {
            return {
              isError: true,
              content: [{ 
                type: "text", 
                text: JSON.stringify({
                  success: false,
                  error: {
                    message: `Error getting table schema: ${result.error}`,
                    code: result.code || "SCHEMA_ERROR"
                  },
                  operation: "xano_get_table_schema"
                })
              }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                data: { schema: result },
                operation: "xano_get_table_schema"
              })
            }]
          };
        } catch (error) {
          console.error(`Error getting table schema: ${error.message}`);
          return {
            isError: true,
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: {
                  message: `Error getting table schema: ${error.message}`,
                  code: "EXCEPTION"
                },
                operation: "xano_get_table_schema"
              })
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

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

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
          
          const result = await makeApiRequest(url, token, "POST", data, this.env);

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

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

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
          
          const result = await makeApiRequest(url, token, "PUT", data, this.env);

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
      {
        annotations: {
          title: "Delete Table",
          readOnlyHint: false,    // This modifies data
          destructiveHint: true,  // This is a destructive operation
          idempotentHint: true,   // Deleting an already deleted table has no effect
          openWorldHint: true     // Interacts with external Xano API
        }
      },
      async ({ instance_name, workspace_id, table_id }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}`;
          
          console.log(`Deleting table ${table_id} from workspace ${workspace_id}`);
          
          const result = await makeApiRequest(url, token, "DELETE", undefined, this.env);

          // Null or empty response is common for successful DELETE operations
          // First check if result exists and has an error property
          if (result && result.error) {
            return {
              isError: true,
              content: [{ 
                type: "text", 
                text: JSON.stringify({
                  success: false,
                  error: {
                    message: `Error deleting table: ${result.error}`,
                    code: result.code || "DELETE_TABLE_ERROR"
                  },
                  operation: "xano_delete_table"
                })
              }]
            };
          }
          
          // If we reach here, the deletion was likely successful
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Table deleted successfully",
                operation: "xano_delete_table"
              })
            }]
          };
        } catch (error) {
          console.error(`Error deleting table: ${error.message}`);
          return {
            isError: true,
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: {
                  message: `Error deleting table: ${error.message}`,
                  code: "EXCEPTION"
                },
                operation: "xano_delete_table"
              })
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
      {
        annotations: {
          title: "Add Field to Schema",
          readOnlyHint: false,    // This changes the database
          destructiveHint: false, // Not destructive, just additive
          idempotentHint: false,  // Adding the same field twice would error
          openWorldHint: true     // Interacts with external Xano API
        }
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

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          
          // Get table schema - following the exact Python implementation pattern
          const schemaUrl = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/schema`;
          console.log(`Fetching schema from ${schemaUrl}`);
          
          // First get the current schema
          const schemaResult = await makeApiRequest(schemaUrl, token, "GET", undefined, this.env);
          
          if (schemaResult.error) {
            return {
              isError: true,
              content: [{ 
                type: "text", 
                text: JSON.stringify({
                  success: false,
                  error: {
                    message: `Error getting table schema: ${schemaResult.error}`,
                    code: schemaResult.code || "SCHEMA_ERROR"
                  },
                  operation: "xano_add_field_to_schema"
                })
              }]
            };
          }
          
          // In Python this is wrapped in {"schema": result}, but we'll handle both formats
          const currentSchema = Array.isArray(schemaResult) ? schemaResult : schemaResult.schema || [];
          
          console.log(`Retrieved schema with ${currentSchema.length} fields`);
          
          // Create the new field
          const newField = {
            name: field_name,
            type: field_type,
            description: description || "",
            nullable: nullable !== undefined ? nullable : false,
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
          
          console.log("Adding new field to schema:", field_name);
          
          // Add the new field to the schema (simply append, just like Python implementation)
          const updatedSchema = [...currentSchema, newField];
          
          // Prepare data for updating schema - follow exactly the Python pattern
          const data = { schema: updatedSchema };
          
          // Update the schema
          console.log(`Updating schema at ${schemaUrl}`);
          const result = await makeApiRequest(schemaUrl, token, "PUT", data, this.env);
          
          if (result && result.error) {
            return {
              isError: true,
              content: [{ 
                type: "text", 
                text: JSON.stringify({
                  success: false,
                  error: {
                    message: `Error updating schema: ${result.error}`,
                    code: result.code || "SCHEMA_UPDATE_ERROR"
                  },
                  operation: "xano_add_field_to_schema"
                })
              }]
            };
          }
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                data: result || { message: "Field added successfully" },
                operation: "xano_add_field_to_schema"
              })
            }]
          };
        } catch (error) {
          console.error(`Error adding field to schema: ${error.message}`);
          return {
            isError: true,
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: {
                  message: `Error adding field to schema: ${error.message}`,
                  code: "EXCEPTION"
                },
                operation: "xano_add_field_to_schema"
              })
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
      {
        annotations: {
          title: "Rename Schema Field",
          readOnlyHint: false,    // This modifies the schema
          destructiveHint: false, // Not destructive, just a rename
          idempotentHint: false,  // Renaming to the same name twice would error
          openWorldHint: true     // Interacts with external Xano API
        }
      },
      async ({ instance_name, workspace_id, table_id, old_name, new_name }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/schema/rename`;
          
          const data = {
            old_name: old_name,
            new_name: new_name
          };
          
          const result = await makeApiRequest(url, token, "POST", data, this.env);

          if (result.error) {
            return {
              isError: true,
              content: [{ 
                type: "text", 
                text: JSON.stringify({
                  success: false,
                  error: {
                    message: `Error renaming schema field: ${result.error}`,
                    code: result.code || "RENAME_FIELD_ERROR"
                  },
                  operation: "xano_rename_schema_field"
                })
              }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                data: result || { message: "Field renamed successfully" },
                operation: "xano_rename_schema_field"
              })
            }]
          };
        } catch (error) {
          console.error(`Error renaming schema field: ${error.message}`);
          return {
            isError: true,
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: {
                  message: `Error renaming schema field: ${error.message}`,
                  code: "EXCEPTION"
                },
                operation: "xano_rename_schema_field"
              })
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

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/schema/${field_name}`;
          
          const result = await makeApiRequest(url, token, "DELETE", undefined, this.env);
          
          // Handle successful DELETE operations (which may return null)
          if (result === null || (typeof result === 'object' && Object.keys(result).length === 0)) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: "Field deleted successfully",
                  operation: "xano_delete_field"
                })
              }]
            };
          }

          // Handle explicit error
          if (result && result.error) {
            return {
              isError: true,
              content: [{ 
                type: "text", 
                text: JSON.stringify({
                  success: false,
                  error: {
                    message: `Error deleting field: ${result.error}`,
                    code: result.code || "DELETE_FIELD_ERROR"
                  },
                  operation: "xano_delete_field"
                })
              }]
            };
          }

          // Return the result if we got something but not an error
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                data: result,
                operation: "xano_delete_field"
              })
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

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

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
          const result = await makeApiRequest(url, token, "GET", undefined, this.env);

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

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/content/${formatId(record_id)}`;
          const result = await makeApiRequest(url, token, "GET", undefined, this.env);

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
      {
        annotations: {
          title: "Create Table Record",
          readOnlyHint: false,    // This modifies data
          destructiveHint: false, // Creates but doesn't destroy anything
          idempotentHint: false,  // Creating the same record twice has different results
          openWorldHint: true     // Interacts with external Xano API
        }
      },
      async ({ instance_name, workspace_id, table_id, record_data }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/content`;
          const result = await makeApiRequest(url, token, "POST", record_data, this.env);

          if (result.error) {
            return {
              isError: true,
              content: [{ 
                type: "text", 
                text: JSON.stringify({
                  success: false,
                  error: {
                    message: `Error creating table record: ${result.error}`,
                    code: result.code || "CREATE_RECORD_ERROR"
                  },
                  operation: "xano_create_table_record"
                })
              }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                data: result,
                operation: "xano_create_table_record"
              })
            }]
          };
        } catch (error) {
          console.error(`Error creating table record: ${error.message}`);
          return {
            isError: true,
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: {
                  message: `Error creating table record: ${error.message}`,
                  code: "EXCEPTION"
                },
                operation: "xano_create_table_record"
              })
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

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/content/${formatId(record_id)}`;
          const result = await makeApiRequest(url, token, "PUT", record_data, this.env);

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

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/content/${formatId(record_id)}`;
          
          console.log(`Deleting record: ${record_id} from table ${table_id}`);
          
          const result = await makeApiRequest(url, token, "DELETE", undefined, this.env);

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
      {
        annotations: {
          title: "Bulk Create Records",
          readOnlyHint: false,    // This modifies data
          destructiveHint: false, // Creates but doesn't destroy
          idempotentHint: false,  // Creates new records each time
          openWorldHint: true     // Interacts with external Xano API
        }
      },
      async ({ instance_name, workspace_id, table_id, records, allow_id_field }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/content/bulk`;
          
          const data = {
            items: records,
            allow_id_field: allow_id_field || false
          };
          
          const result = await makeApiRequest(url, token, "POST", data, this.env);
          console.log("Bulk create response:", JSON.stringify(result));

          // Handle Xano's specific bulk operation response format
          // which returns: { error: [], success: [ids], success_total: n }
          if (result && 'success_total' in result) {
            // This is Xano's standard bulk operation success response
            // Check if there are any errors in the error array
            if (Array.isArray(result.error) && result.error.length > 0) {
              // There were some errors in the batch operation
              return {
                isError: true,
                content: [{ 
                  type: "text", 
                  text: JSON.stringify({
                    success: false,
                    error: {
                      message: `Partial bulk creation failure: ${result.error.length} records failed`,
                      code: "PARTIAL_CREATE_FAILURE",
                      details: {
                        failed: result.error,
                        succeeded: result.success,
                        success_count: result.success_total
                      }
                    },
                    operation: "xano_bulk_create_records"
                  })
                }]
              };
            } else {
              // Complete success - all records created
              return {
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: true,
                    message: `Successfully created ${result.success_total} records`,
                    data: {
                      created_records: result.success,
                      created_count: result.success_total
                    },
                    operation: "xano_bulk_create_records"
                  })
                }]
              };
            }
          } 
          // Handle standard error
          else if (result && result.error && typeof result.error === 'string') {
            return {
              isError: true,
              content: [{ 
                type: "text", 
                text: JSON.stringify({
                  success: false,
                  error: {
                    message: `Error in bulk creation: ${result.error}`,
                    code: result.code || "BULK_CREATE_ERROR"
                  },
                  operation: "xano_bulk_create_records"
                })
              }]
            };
          }
          // Handle null or empty response
          else if (result === null || (typeof result === 'object' && Object.keys(result).length === 0)) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: "Records created successfully",
                  affected_count: records.length,
                  operation: "xano_bulk_create_records"
                })
              }]
            };
          }
          // Any other response format
          else {
            // Default - just return the data
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  success: true,
                  data: result,
                  operation: "xano_bulk_create_records"
                })
              }]
            };
          };
        } catch (error) {
          console.error(`Error bulk creating records: ${error.message}`);
          return {
            isError: true,
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: {
                  message: `Error bulk creating records: ${error.message}`,
                  code: "EXCEPTION"
                },
                operation: "xano_bulk_create_records"
              })
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
          row_id: z.union([z.string(), z.number()]).describe("ID of the record to update"),
          updates: z.record(z.any()).describe("Object containing the fields to update and their new values")
        })).describe("List of update operations, each containing row_id and a nested updates object with fields to change")
      },
      {
        annotations: {
          title: "Bulk Update Records",
          readOnlyHint: false,    // This modifies data
          destructiveHint: false, // Updates but doesn't destroy
          idempotentHint: true,   // Same updates applied twice have same effect
          openWorldHint: true     // Interacts with external Xano API
        }
      },
      async ({ instance_name, workspace_id, table_id, updates }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

        if (!token) {
          return {
            content: [{ type: "text", text: "API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/content/bulk/patch`;
          
          // Format row_ids in updates to ensure they're strings
          // AND make sure each update has exactly row_id and updates fields
          const formattedUpdates = updates.map(update => {
            // Check if update already has the correct structure
            if (update.row_id && update.updates && Object.keys(update).length === 2) {
              return {
                row_id: formatId(update.row_id),
                updates: update.updates
              };
            }
            
            // If not properly structured, try to extract correctly
            const { row_id, ...otherFields } = update;
            
            if (!row_id) {
              console.error("Missing row_id in update:", update);
              throw new Error("Missing row_id in update");
            }
            
            return {
              row_id: formatId(row_id),
              updates: update.updates || otherFields // Use updates field if it exists, otherwise use all other fields
            };
          });
          
          const data = {
            items: formattedUpdates
          };
          
          // Log the request data for debugging
          console.log("Bulk update request URL:", url);
          console.log("Bulk update request data:", JSON.stringify(data));
          
          const result = await makeApiRequest(url, token, "POST", data, this.env);
          console.log("Bulk update response:", JSON.stringify(result));

          // Handle Xano's specific bulk update response format
          // which returns: { error: [], success: [ids], success_total: n }
          if (result && 'success_total' in result) {
            // This is Xano's standard bulk operation success response
            // Check if there are any errors in the error array
            if (Array.isArray(result.error) && result.error.length > 0) {
              // There were some errors in the batch operation
              return {
                isError: true,
                content: [{ 
                  type: "text", 
                  text: JSON.stringify({
                    success: false,
                    error: {
                      message: `Partial bulk update failure: ${result.error.length} records failed`,
                      code: "PARTIAL_UPDATE_FAILURE",
                      details: {
                        failed: result.error,
                        succeeded: result.success,
                        success_count: result.success_total
                      }
                    },
                    operation: "xano_bulk_update_records"
                  })
                }]
              };
            } else {
              // Complete success - all records updated
              return {
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: true,
                    message: `Successfully updated ${result.success_total} records`,
                    data: {
                      updated_records: result.success,
                      update_count: result.success_total
                    },
                    operation: "xano_bulk_update_records"
                  })
                }]
              };
            }
          } 
          // Handle null or empty response
          else if (result === null || (typeof result === 'object' && Object.keys(result).length === 0)) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: "Records updated successfully",
                  affected_count: updates.length,
                  operation: "xano_bulk_update_records"
                })
              }]
            };
          } 
          // Handle explicit error
          else if (result && result.error && typeof result.error === 'string') {
            return {
              isError: true,
              content: [{ 
                type: "text", 
                text: JSON.stringify({
                  success: false,
                  error: {
                    message: `Error in bulk update: ${result.error}`,
                    code: result.code || "BULK_UPDATE_ERROR"
                  },
                  operation: "xano_bulk_update_records"
                })
              }]
            };
          } 
          // Any other response format
          else {
            // Default - just return the data
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  success: true,
                  data: result,
                  operation: "xano_bulk_update_records"
                })
              }]
            };
          }
        } catch (error) {
          console.error(`Error bulk updating records: ${error.message}`);
          return {
            isError: true,
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: {
                  message: `Error bulk updating records: ${error.message}`,
                  code: "EXCEPTION"
                },
                operation: "xano_bulk_update_records"
              })
            }]
          };
        }
      }
    );
  }
}

// Create the OAuth provider instance
const oauthProvider = new OAuthProvider({
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

// Export the OAuth provider as default
export default oauthProvider;

// Queue message types for usage logging
interface MessageBatch<T = any> {
  readonly queue: string
  readonly messages: Message<T>[]
}

interface Message<T = any> {
  readonly id: string
  readonly timestamp: Date
  readonly body: T
  ack(): void
  retry(): void
}

// Queue consumer handler for usage logging
export async function queue(batch: MessageBatch, env: Env): Promise<void> {
  const { default: queueConsumer } = await import('./queue-consumer');
  await queueConsumer.queue(batch, env);
}

// Environment type
export interface Env {
  MCP_OBJECT: DurableObjectNamespace;
  OAUTH_KV: KVNamespace;
  SESSION_CACHE: KVNamespace;
  USAGE_QUEUE: Queue;
  XANO_BASE_URL: string;
  COOKIE_ENCRYPTION_KEY: string;
  OAUTH_TOKEN_TTL?: string; // Optional TTL in seconds, defaults to 24 hours
}