import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { XanoHandler } from "./xano-handler";
import { makeApiRequest, getMetaApiUrl, formatId, Props } from "./utils";
import { SmartError, resolveTableId, normalizeTableIdentifier } from "./smart-error";

// Use the Props type from utils.ts as XanoAuthProps
export type XanoAuthProps = Props;

// Helper functions for session management
async function deleteAllAuthTokens(env: Env): Promise<number> {
  let deletedCount = 0;
  
  // Delete token: entries
  const tokenEntries = await env.OAUTH_KV.list({ prefix: 'token:' });
  for (const key of tokenEntries.keys || []) {
    await env.OAUTH_KV.delete(key.name);
    deletedCount++;
  }
  
  // Delete xano_auth_token: entries
  const xanoAuthEntries = await env.OAUTH_KV.list({ prefix: 'xano_auth_token:' });
  for (const key of xanoAuthEntries.keys || []) {
    await env.OAUTH_KV.delete(key.name);
    deletedCount++;
  }
  
  // Delete refresh: entries
  const refreshEntries = await env.OAUTH_KV.list({ prefix: 'refresh:' });
  for (const key of refreshEntries.keys || []) {
    await env.OAUTH_KV.delete(key.name);
    deletedCount++;
  }
  
  return deletedCount;
}

async function getActiveWorkerSessions(env: Env): Promise<{success: boolean, sessions?: any[], error?: string}> {
  try {
    const sessions = await env.OAUTH_KV.list({ prefix: 'session:' });
    const sessionList = [];
    
    for (const key of sessions.keys || []) {
      const sessionData = await env.OAUTH_KV.get(key.name);
      if (sessionData) {
        sessionList.push({
          sessionId: key.name.replace('session:', ''),
          data: JSON.parse(sessionData)
        });
      }
    }
    
    return { success: true, sessions: sessionList };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function disableWorkerSession(sessionId: string, env: Env): Promise<{success: boolean, sessionEnabled?: boolean, error?: string}> {
  try {
    const sessionKey = `session:${sessionId}`;
    const sessionData = await env.OAUTH_KV.get(sessionKey);
    
    if (sessionData) {
      const data = JSON.parse(sessionData);
      data.enabled = false;
      await env.OAUTH_KV.put(sessionKey, JSON.stringify(data, null, 2));
      return { success: true, sessionEnabled: false };
    }
    
    return { success: false, error: "Session not found" };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function enableWorkerSession(sessionId: string, env: Env): Promise<{success: boolean, sessionEnabled?: boolean, error?: string}> {
  try {
    const sessionKey = `session:${sessionId}`;
    const sessionData = await env.OAUTH_KV.get(sessionKey);
    
    if (sessionData) {
      const data = JSON.parse(sessionData);
      data.enabled = true;
      await env.OAUTH_KV.put(sessionKey, JSON.stringify(data, null, 2));
      return { success: true, sessionEnabled: true };
    }
    
    return { success: false, error: "Session not found" };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Define MCP agent for Xano
export class MyMCP extends McpAgent<Env, unknown, XanoAuthProps> {
  server = new McpServer({
    name: "Snappy MCP Server",
    version: "1.0.0",
  });
  
  

  async getFreshApiKey(): Promise<string | null> {
    // Simple approach - just use the API key from props
    // When OAuth token expires, user will need to re-authenticate
    console.log("getFreshApiKey called with props:", {
      userId: this.props?.userId,
      email: this.props?.email,
      hasApiKey: !!this.props?.apiKey,
      apiKeyPrefix: this.props?.apiKey ? this.props.apiKey.substring(0, 20) + "..." : null
    });
    return this.props?.apiKey || null;
  }

  // Helper method to make API requests with automatic userId passing
  async makeAuthenticatedRequest(url: string, method = "GET", data?: any): Promise<any> {
    const token = await this.getFreshApiKey();
    if (!token) {
      throw new Error("No API key available");
    }
    // Pass userId from props for proper user-scoped refresh
    return makeApiRequest(url, token, method, data, this.env, this.props?.userId);
  }

  async init() {
    
    // 🔍 Debug tool to see what props are available
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
    
    // Tool to manually trigger a profile refresh
    // This tool is only for debugging purposes
    this.server.tool(
      "debug_refresh_profile",
      {},
      async () => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "🔐 Authentication required to use this tool." }]
          };
        }
        
        return {
          content: [{ type: "text", text: "This functionality has been removed for simplicity." }]
        };
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
          
          // Get counts before deletion for detailed response
          const tokenEntriesBefore = await this.env.OAUTH_KV.list({ prefix: 'token:' });
          const xanoAuthEntriesBefore = await this.env.OAUTH_KV.list({ prefix: 'xano_auth_token:' });
          const refreshEntriesBefore = await this.env.OAUTH_KV.list({ prefix: 'refresh:' });
          
          // Use our clean helper to delete all tokens
          const deletedCount = await deleteAllAuthTokens(this.env);
          
          return {
            content: [{
              type: "text",
              text: `🗑️ Token Cleanup - ${deletedCount} tokens deleted\n${"=".repeat(50)}\n` + JSON.stringify({
                success: true,
                message: `Deleted ${deletedCount} authentication tokens`,
                note: "All tokens have been deleted. The next tool call will trigger OAuth re-authentication. You may need to refresh your MCP client or restart the connection.",
                deleted: {
                  oauth_tokens: tokenEntriesBefore.keys?.length || 0,
                  xano_auth_tokens: xanoAuthEntriesBefore.keys?.length || 0,
                  refresh_tokens: refreshEntriesBefore.keys?.length || 0
                }
              }, null, 2)
            }]
          };
        } catch (error) {
          console.error("Error deleting OAuth tokens:", error);
          return {
            content: [{
              type: "text",
              text: `Error deleting OAuth tokens: ${error.message || "Unknown error"}`
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
              text: "🔑 KV STORAGE DEBUG\n\n" + JSON.stringify({
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
            text: `👤 User Info - ${this.props.userDetails?.name || this.props.userId} | Authenticated\n${"=".repeat(50)}\n` + JSON.stringify({
              userId: this.props.userId,
              name: this.props.userDetails?.name,
              authenticated: true
            }, null, 2)
          }]
        };
      }
    );

    // Session control tools - test our new TDD implementation
    this.server.tool(
      "debug_session_info",
      {},
      async () => {
        const sessionInfo = await this.getSessionInfo();
        return {
          content: [{
            type: "text",
            text: `🔍 Session Info - ${sessionInfo ? 'Active' : 'None'} | User: ${this.props?.userId || 'N/A'}\n${"=".repeat(50)}\n` + JSON.stringify({
              success: !!sessionInfo,
              sessionInfo: sessionInfo,
              rawProps: {
                authenticated: this.props?.authenticated,
                userId: this.props?.userId,
                sessionId: this.props?.sessionId,
                hasSessionId: !!this.props?.sessionId
              },
              message: sessionInfo 
                ? "✅ Real Worker session ID found and extracted" 
                : "❌ No real Worker session ID available (TDD logic working correctly)"
            }, null, 2)
          }]
        };
      }
    );

    this.server.tool(
      "debug_list_active_sessions",
      {},
      async () => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "🔐 Authentication Required - Access denied\n==================================================\nAuthentication required to use this tool." }]
          };
        }

        try {
          const result = await getActiveWorkerSessions(this.env);
          return {
            content: [{
              type: "text",
              text: "📋 ACTIVE SESSIONS\n\n" + JSON.stringify({
                success: result.success,
                sessionCount: result.sessions?.length || 0,
                sessions: result.sessions,
                error: result.error
              }, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error listing sessions: ${error.message}`
            }]
          };
        }
      }
    );

    this.server.tool(
      "debug_test_session_control",
      {
        action: z.enum(['disable', 'enable']).describe("Action to test"),
        sessionId: z.string().describe("Session ID to control")
      },
      async ({ action, sessionId }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "🔐 Authentication Required - Access denied\n==================================================\nAuthentication required to use this tool." }]
          };
        }

        try {
          const result = action === 'disable' 
            ? await disableWorkerSession(sessionId, this.env)
            : await enableWorkerSession(sessionId, this.env);

          return {
            content: [{
              type: "text",
              text: "🔧 SESSION CONTROL\n\n" + JSON.stringify({
                action: action,
                sessionId: sessionId,
                success: result.success,
                sessionEnabled: result.sessionEnabled,
                error: result.error
              }, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error ${action}ing session: ${error.message}`
            }]
          };
        }
      }
    );

    // 👋 Register hello tool
    this.server.tool(
      "hello",
      { name: z.string() },
      async ({ name }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "🔐 Authentication Required - Access denied\n==================================================\nAuthentication required to use this tool." }]
          };
        }

        return {
          content: [{ type: "text", text: `👋 Hello Response - "${name}" | User: ${this.props.userId}\n${"=".repeat(50)}\n` + JSON.stringify({
            message: `Hello, ${name}! You are authenticated as ${this.props.userId}.`,
            user: this.props.userId,
            name: name,
            authenticated: true
          }, null, 2) }]
        };
      }
    );

    // 🏢 List Xano instances
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
            content: [{ type: "text", text: "🔐 Authentication Required - Access denied\n==================================================\nAuthentication required to use this tool." }]
          };
        }

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

        if (!token) {
          return {
            content: [{ type: "text", text: "🏢 API key not available. Please ensure you are authenticated." }]
          };
        }

        try {
          const url = "https://app.xano.com/api:meta/instance";
          const result = await makeApiRequest(url, token, "GET", undefined, this.env);

          if (result.error) {
            return {
              content: [{ type: "text", text: `🏢 Error: ${result.error}` }]
            };
          }

          return {
            content: [{
              type: "text",
              text: `🏢 Xano Instances - ${result.length} instance(s) found\n${"=".repeat(50)}\n` + JSON.stringify({ instances: result }, null, 2)
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
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "🔐 Authentication Required - Access denied\n==================================================\nAuthentication required to use this tool." }]
          };
        }

        try {
          // Use the full domain provided (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')
          const instanceDomain = instance_name.includes('.') ? instance_name : `${instance_name}.n7c.xano.io`;
          
          // Extract instance ID from domain for display name
          const instanceId = instance_name.split('.')[0];
          const displayName = instanceId.split("-")[0].toUpperCase();
          
          const details = {
            name: instanceId,
            display: displayName,
            xano_domain: instanceDomain,
            rate_limit: false,
            meta_api: `https://${instanceDomain}/api:meta`,
            meta_swagger: `https://${instanceDomain}/apispec:meta?type=json`,
          };

          return {
            content: [{
              type: "text",
              text: `🏗️ Instance Details - "${instanceId}" | Domain: ${instanceDomain}\n${"=".repeat(50)}\n` + JSON.stringify(details, null, 2)
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

    // 💾 List databases
    this.server.tool(
      "xano_list_databases",
      {
        instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')")
      },
      async ({ instance_name }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "🔐 Authentication Required - Access denied\n==================================================\nAuthentication required to use this tool." }]
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
              text: `💾 Xano Databases - ${Array.isArray(result) ? result.length : 0} workspace(s) found\n${"=".repeat(50)}\n` + JSON.stringify({ databases: result }, null, 2)
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

    // 🏗️ Get workspace details
    this.server.tool(
      "xano_get_workspace_details",
      {
        instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace")
      },
      async ({ instance_name, workspace_id }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "🔐 Authentication Required - Access denied\n==================================================\nAuthentication required to use this tool." }]
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
              content: [{ type: "text", text: `❌ Tool Failed - ${result.error}\n\${"=".repeat(50)}\n${result.error}` }]
            };
          }

          return {
            content: [{
              type: "text",
              text: `🗂️ Workspace Details - "${result.name}" | ID: ${result.id} | Branch: ${result.branch}\n\${"=".repeat(50)}\n` + JSON.stringify(result, null, 2)
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

    // 📋 List tables
    this.server.tool(
      "xano_list_tables",
      {
        instance_name: z.string().describe("Xano instance (e.g., 'xnwv-v1z6-dvnr'). Domain extension added automatically."),
        database_id: z.union([z.string(), z.number()]).describe("Workspace/database ID. Use xano_list_databases to find workspace IDs.")
      },
      async ({ instance_name, database_id }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return SmartError.authenticationFailed().toMCPResponse();
        }

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

        if (!token) {
          return SmartError.authenticationFailed().toMCPResponse();
        }

        try {
          const metaApi = getMetaApiUrl(instance_name);
          const url = `${metaApi}/workspace/${formatId(database_id)}/table`;
          const result = await makeApiRequest(url, token, "GET", undefined, this.env);

          if (result.error) {
            return new SmartError(
              "Failed to list tables", 
              "Check your workspace ID and permissions",
              {
                tip: "Use xano_list_databases to verify workspace ID",
                relatedTools: ["xano_list_databases", "xano_get_workspace_details"]
              }
            ).toMCPResponse();
          }

          return {
            content: [{
              type: "text",
              text: `📋 Tables - ${Array.isArray(result) ? result.length : 0} table(s) found | Workspace ${database_id}\n${"=".repeat(50)}\n` + JSON.stringify({ 
                tables: result,
                summary: `Found ${Array.isArray(result) ? result.length : 0} tables`
              }, null, 2)
            }]
          };
        } catch (error) {
          console.error(`Error listing tables: ${error.message}`);
          
          // Handle SmartError instances
          if (error instanceof SmartError) {
            return error.toMCPResponse();
          }
          
          return new SmartError(
            "Failed to list tables",
            "An unexpected error occurred",
            {
              tip: error.message,
              relatedTools: ["xano_list_databases"]
            }
          ).toMCPResponse();
        }
      }
    );

    // NEW TOOLS ADDED BELOW
    // ======================

    // Get table details
    this.server.tool(
      "xano_get_table_details",
      {
        instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
        table_id: z.union([z.string(), z.number()]).describe("The ID of the table")
      },
      async ({ instance_name, workspace_id, table_id }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "🔐 Authentication Required - Access denied\n==================================================\nAuthentication required to use this tool." }]
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
              content: [{ type: "text", text: `❌ Tool Failed - ${result.error}\n\${"=".repeat(50)}\n${result.error}` }]
            };
          }

          return {
            content: [{
              type: "text",
              text: `📋 Table Details - "${result.name}" | ID: ${result.id} | Auth: ${result.auth}\n\${"=".repeat(50)}\n` + JSON.stringify(result, null, 2)
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
        instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
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
            content: [{ type: "text", text: "🔐 Authentication Required - Access denied\n==================================================\nAuthentication required to use this tool." }]
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
                text: `❌ Schema Error - Table ${table_id} | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: false,
                  error: {
                    message: `Error getting table schema: ${result.error}`,
                    code: result.code || "SCHEMA_ERROR"
                  },
                  operation: "xano_get_table_schema"
                }, null, 2)
              }]
            };
          }

          return {
            content: [{
              type: "text",
              text: `🔧 Table Schema - ${Array.isArray(result?.fields) ? result.fields.length : 0} field(s) | Table ${table_id}\n${"=".repeat(50)}\n` + JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          console.error(`Error getting table schema: ${error.message}`);
          return {
            isError: true,
            content: [{
              type: "text",
              text: `❌ Schema Exception - Table ${table_id} | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                success: false,
                error: {
                  message: `Error getting table schema: ${error.message}`,
                  code: "EXCEPTION"
                },
                operation: "xano_get_table_schema"
              }, null, 2)
            }]
          };
        }
      }
    );

    // Create table
    this.server.tool(
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
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "🔐 Authentication Required - Access denied\n==================================================\nAuthentication required to use this tool." }]
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
              text: `📊 Table Created - ID: ${result.id} | Workspace: ${result.workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify(result, null, 2)
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
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "✏️ Authentication required to use this tool." }]
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
            text: `✏️ Table Updated - ID: ${table_id} | Fields modified\n${"=".repeat(50)}\n` + JSON.stringify(result, null, 2)
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
        instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
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
            content: [{ type: "text", text: "🗑️ Authentication required to use this tool." }]
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
                text: `❌ Delete Table Error - Table ${table_id} | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: false,
                  error: {
                    message: `Error deleting table: ${result.error}`,
                    code: result.code || "DELETE_TABLE_ERROR"
                  },
                  operation: "xano_delete_table"
                }, null, 2)
              }]
            };
          }
          
          // If we reach here, the deletion was likely successful
          return {
            content: [{
              type: "text",
              text: `🗑️ Table Deleted - ID: ${table_id} | Workspace: ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                success: true,
                message: "Table deleted successfully",
                table_id: table_id,
                workspace_id: workspace_id
              }, null, 2)
            }]
          };
        } catch (error) {
          console.error(`Error deleting table: ${error.message}`);
          return {
            isError: true,
            content: [{
              type: "text",
              text: `❌ Delete Table Exception - Table ${table_id} | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                success: false,
                error: {
                  message: `Error deleting table: ${error.message}`,
                  code: "EXCEPTION"
                },
                operation: "xano_delete_table"
              }, null, 2)
            }]
          };
        }
      }
    );

    // Add field to schema
    this.server.tool(
      "xano_add_field_to_schema",
      {
        instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
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
            content: [{ type: "text", text: "➕ Authentication required to use this tool." }]
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
                text: `❌ Add Field Schema Error - Table ${table_id} | Field: ${field_name}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: false,
                  error: {
                    message: `Error getting table schema: ${schemaResult.error}`,
                    code: schemaResult.code || "SCHEMA_ERROR"
                  },
                  operation: "xano_add_field_to_schema"
                }, null, 2)
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
                text: `❌ Add Field Error - Field: ${field_name} | Table ${table_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: false,
                  error: {
                    message: `Error updating schema: ${result.error}`,
                    code: result.code || "SCHEMA_UPDATE_ERROR"
                  },
                  operation: "xano_add_field_to_schema"
                }, null, 2)
              }]
            };
          }
          
          return {
            content: [{
              type: "text",
              text: `➕ Field Added - ${field_name} (${field_type}) | Table ${table_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                success: true,
                field_name: field_name,
                field_type: field_type,
                table_id: table_id,
                data: result || { message: "Field added successfully" }
              }, null, 2)
            }]
          };
        } catch (error) {
          console.error(`Error adding field to schema: ${error.message}`);
          return {
            isError: true,
            content: [{
              type: "text",
              text: `❌ Add Field Exception - Field: ${field_name} | Table ${table_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                success: false,
                error: {
                  message: `Error adding field to schema: ${error.message}`,
                  code: "EXCEPTION"
                },
                operation: "xano_add_field_to_schema"
              }, null, 2)
            }]
          };
        }
      }
    );

    // Rename schema field
    this.server.tool(
      "xano_rename_schema_field",
      {
        instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
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
            content: [{ type: "text", text: "✏️ Authentication required to use this tool." }]
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
              text: `✏️ Field Renamed - ${old_name} → ${new_name} | Table ${table_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                success: true,
                old_name: old_name,
                new_name: new_name,
                table_id: table_id,
                data: result || { message: "Field renamed successfully" }
              }, null, 2)
            }]
          };
        } catch (error) {
          console.error(`Error renaming schema field: ${error.message}`);
          return {
            isError: true,
            content: [{
              type: "text",
              text: JSON.stringify({
                "✏️ FIELD RENAMED": true,
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
        instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
        table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
        field_name: z.string().describe("The name of the field to delete")
      },
      async ({ instance_name, workspace_id, table_id, field_name }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "❌ Authentication required to use this tool." }]
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
                text: `🗑️ Field Deleted - ${field_name} | Table ${table_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  message: "Field deleted successfully",
                  field_name: field_name,
                  table_id: table_id
                }, null, 2)
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
                "🗑️ FIELD DELETED": true,
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
                "🗑️ FIELD DELETED": true,
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

    // 📊 Browse table content
    this.server.tool(
      "xano_browse_table_content",
      {
        instance_name: z.string().describe("Xano instance (e.g., 'xnwv-v1z6-dvnr'). Domain extension added automatically."),
        workspace_id: z.union([z.string(), z.number()]).describe("Workspace/database ID. Use xano_list_databases to find workspace IDs."),
        table_id: z.union([z.string(), z.number()]).optional().describe("Table ID (e.g., 70). Use table parameter instead for easier access."),
        table: z.string().optional().describe("Table name as alternative to table_id (e.g., 'users' or '👤 users')"),
        page: z.number().optional().describe("Page number (default: 1)"),
        per_page: z.number().optional().describe("Number of records per page (default: 50)")
      },
      async ({ instance_name, workspace_id, table_id, table, page, per_page }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return SmartError.authenticationFailed().toMCPResponse();
        }

        // Validate table identifier
        if (!table_id && !table) {
          return new SmartError(
            "Table identifier required",
            "Provide either table_id or table parameter",
            {
              correct: 'table: "users" or table_id: 70',
              tip: "Using table names is easier than looking up IDs",
              relatedTools: ["xano_list_tables"]
            }
          ).toMCPResponse();
        }

        // Use fresh API key from KV storage
        const token = await this.getFreshApiKey();

        if (!token) {
          return SmartError.authenticationFailed().toMCPResponse();
        }

        try {
          let resolvedTableId = table_id;

          // If table name provided, resolve to ID
          if (table && !table_id) {
            // Simple table name resolution - fetch tables and match
            const metaApiForTables = getMetaApiUrl(instance_name);
            const tablesUrl = `${metaApiForTables}/workspace/${formatId(workspace_id)}/table`;
            const tablesResult = await makeApiRequest(tablesUrl, token, "GET", undefined, this.env);
            
            if (tablesResult.error) {
              return new SmartError(
                `Cannot resolve table name '${table}'`,
                "Failed to fetch tables list",
                {
                  tip: "Check workspace ID and permissions",
                  relatedTools: ["xano_list_tables"]
                }
              ).toMCPResponse();
            }
            
            const tables = Array.isArray(tablesResult) ? tablesResult : [];
            const match = tables.find(t => 
              t.name === table || 
              t.name.toLowerCase() === table.toLowerCase() ||
              t.name.replace(/^.+?\s/, '') === table ||
              t.name.replace(/^.+?\s/, '').toLowerCase() === table.toLowerCase()
            );
            
            if (!match) {
              return new SmartError(
                `Table '${table}' not found`,
                "Check the table name spelling",
                {
                  tip: `Available tables: ${tables.slice(0, 3).map(t => t.name).join(', ')}...`,
                  relatedTools: ["xano_list_tables"]
                }
              ).toMCPResponse();
            }
            
            resolvedTableId = match.id;
          }

          const metaApi = getMetaApiUrl(instance_name);
          const baseUrl = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(resolvedTableId)}/content`;
          
          // Add pagination parameters to URL
          const params = new URLSearchParams();
          if (page !== undefined) params.append('page', page.toString());
          if (per_page !== undefined) params.append('per_page', per_page.toString());
          
          const url = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
          const result = await makeApiRequest(url, token, "GET", undefined, this.env);

          if (result.error) {
            return new SmartError(
              "Failed to browse table content",
              "Check table ID/name and permissions",
              {
                tip: result.error,
                relatedTools: ["xano_list_tables", "xano_get_table_details"]
              }
            ).toMCPResponse();
          }

          return {
            content: [{
              type: "text",
              text: `📊 Table Content - ${Array.isArray(result) ? result.length : 0} record(s) | ${table || `Table ${resolvedTableId}`}\n${"=".repeat(50)}\n` + JSON.stringify({
                records: result,
                metadata: {
                  table: table || `Table ID ${resolvedTableId}`,
                  workspace: workspace_id,
                  page: page || 1,
                  per_page: per_page || 50,
                  count: Array.isArray(result) ? result.length : 0
                }
              }, null, 2)
            }]
          };
        } catch (error) {
          console.error(`Error browsing table content: ${error.message}`);
          
          // Handle SmartError instances
          if (error instanceof SmartError) {
            return error.toMCPResponse();
          }
          
          return new SmartError(
            "Failed to browse table content",
            "An unexpected error occurred",
            {
              tip: error.message,
              relatedTools: ["xano_list_tables"]
            }
          ).toMCPResponse();
        }
      }
    );

    // Search table content tool removed - causing Claude to crash

    // Get table record
    this.server.tool(
      "xano_get_table_record",
      {
        instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
        table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
        record_id: z.union([z.string(), z.number()]).describe("The ID of the record to retrieve")
      },
      async ({ instance_name, workspace_id, table_id, record_id }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "📄 Authentication required to use this tool." }]
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
              text: `📄 Record Details - ID: ${record_id} | Table ${table_id}\n${"=".repeat(50)}\n` + JSON.stringify(result, null, 2)
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
        instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
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
            content: [{ type: "text", text: "📝 Authentication required to use this tool." }]
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
              text: `➕ Record Created - ID: ${result?.id || 'N/A'} | Table ${table_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                success: true,
                record_id: result?.id,
                table_id: table_id,
                data: result
              }, null, 2)
            }]
          };
        } catch (error) {
          console.error(`Error creating table record: ${error.message}`);
          return {
            isError: true,
            content: [{
              type: "text",
              text: JSON.stringify({
                "➕ RECORD CREATED": true,
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
        instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
        table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
        record_id: z.union([z.string(), z.number()]).describe("The ID of the record to update"),
        record_data: z.record(z.any()).describe("The updated data for the record")
      },
      async ({ instance_name, workspace_id, table_id, record_id, record_data }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "📝 Authentication required to use this tool." }]
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
              text: `✏️ Record Updated - ID: ${record_id} | Table ${table_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                success: true,
                record_id: record_id,
                table_id: table_id,
                data: result
              }, null, 2)
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
        instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
        workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
        table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
        record_id: z.union([z.string(), z.number()]).describe("The ID of the record to delete")
      },
      async ({ instance_name, workspace_id, table_id, record_id }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "❌ Authentication required to use this tool." }]
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
            text: `🗑️ Record Deleted - ID: ${record_id} | Table ${table_id}\n${"=".repeat(50)}\n` + JSON.stringify({
              success: true,
              message: "Record deleted successfully",
              record_id: record_id,
              table_id: table_id
            }, null, 2)
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
        instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
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
            content: [{ type: "text", text: "📋 Authentication required to use this tool." }]
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
          console.log("Bulk create response:", JSON.stringify(result, null, 2));

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
                  text: `➕ Bulk Records Created - ${result.success_total} record(s) | Table ${table_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                    success: true,
                    message: `Successfully created ${result.success_total} records`,
                    created_count: result.success_total,
                    created_records: result.success,
                    table_id: table_id
                  }, null, 2)
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
                "➕ BULK CREATE": true,
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
                "➕ BULK CREATE": true,
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
                "➕ BULK CREATE": true,
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
                "➕ BULK CREATE": true,
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
        instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
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
            content: [{ type: "text", text: "🔄 Authentication required to use this tool." }]
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
          console.log("Bulk update request data:", JSON.stringify(data, null, 2));
          
          const result = await makeApiRequest(url, token, "POST", data, this.env);
          console.log("Bulk update response:", JSON.stringify(result, null, 2));

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
                  text: `✏️ Bulk Records Updated - ${result.success_total} record(s) | Table ${table_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                    success: true,
                    message: `Successfully updated ${result.success_total} records`,
                    updated_count: result.success_total,
                    updated_records: result.success,
                    table_id: table_id
                  }, null, 2)
                }]
              };
            }
          } 
          // Handle null or empty response
          else if (result === null || (typeof result === 'object' && Object.keys(result).length === 0)) {
            return {
              content: [{
                type: "text",
                text: "✏️ BULK UPDATE\n\n" + JSON.stringify({
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
                text: "✏️ BULK UPDATE\n\n" + JSON.stringify({
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
                text: "✏️ BULK UPDATE\n\n" + JSON.stringify({
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
              text: "✏️ BULK UPDATE\n\n" + JSON.stringify({
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
    // ===========================
    // ADDITIONAL XANO TOOLS
    // ===========================
    
        this.server.tool(
          "xano_auth_me",
          {},
          async () => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "🔐 Authentication Required - Access denied\n==================================================\nAuthentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const url = `https://app.xano.com/api:meta/auth/me`;
              const result = await makeApiRequest(url, token, "GET", null, this.env);

              return {
                content: [{ type: "text", text: `🔐 Authentication Status - ${result?.name || result?.email || 'User'} | Authenticated\n${"=".repeat(50)}\n` + JSON.stringify(result, null, 2) }]
              };
            } catch (error) {
              return {
                content: [{ type: "text", text: `Error: ${error.message}` }]
              };
            }
          }
        );

        this.server.tool(
          "xano_list_files",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            page: z.number().optional().describe("Page number (default: 1)"),
            per_page: z.number().optional().describe("Number of files per page (default: 50)")
          },
          async ({ instance_name, workspace_id, page = 1, per_page = 50 }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "📁 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const params = new URLSearchParams({
                page: page.toString(),
                per_page: per_page.toString()
              });

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/workspace/${formatId(workspace_id)}/file?${params}`;
              const result = await makeApiRequest(url, token, "GET", null, this.env);

              return {
                content: [{ type: "text", text: `📁 Files List - ${Array.isArray(result) ? result.length : 0} file(s) | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify(result, null, 2) }]
              };
            } catch (error) {
              return {
                content: [{ type: "text", text: `Error: ${error.message}` }]
              };
            }
          }
        );

        this.server.tool(
          "xano_upload_file",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            file_name: z.string().describe("Name of the file to upload"),
            file_content: z.string().describe("Base64 encoded file content"),
            folder: z.string().optional().describe("Folder path to upload to")
          },
          async ({ instance_name, workspace_id, file_name, file_content, folder }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "📤 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              // Convert base64 to blob
              let fileBlob: Blob;
              if (file_content.startsWith('data:')) {
                // Handle data URL
                const [header, base64] = file_content.split(',');
                const binary = atob(base64);
                const array = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                  array[i] = binary.charCodeAt(i);
                }
                const mimeMatch = header.match(/data:([^;]+)/);
                const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
                fileBlob = new Blob([array], { type: mimeType });
              } else {
                // Assume it's already base64
                const binary = atob(file_content);
                const array = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                  array[i] = binary.charCodeAt(i);
                }
                fileBlob = new Blob([array], { type: 'application/octet-stream' });
              }

              // Create FormData
              const formData = new FormData();
              formData.append('content', fileBlob, file_name);
          
              // Detect file type from extension
              const ext = file_name.split('.').pop()?.toLowerCase();
              let fileType = '';
              if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
                fileType = 'image';
              } else if (['mp4', 'mov', 'avi', 'webm'].includes(ext || '')) {
                fileType = 'video';
              } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext || '')) {
                fileType = 'audio';
              }
          
              if (fileType) {
                formData.append('type', fileType);
              }
              formData.append('access', 'public');
          
              if (folder) {
                formData.append('folder', folder);
              }

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/workspace/${formatId(workspace_id)}/file`;
          
              // Make request with FormData
              const response = await fetch(url, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json'
                },
                body: formData
              });

              if (!response.ok) {
                const error = await response.text();
                throw new Error(`HTTP ${response.status}: ${error}`);
              }

              const result = await response.json();

              return {
                content: [{ type: "text", text: `📤 File Uploaded - ${file_name} | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  file_name: file_name,
                  workspace_id: workspace_id,
                  file_id: result?.id,
                  data: result
                }, null, 2) }]
              };
            } catch (error) {
              return {
                content: [{ type: "text", text: `Error: ${error.message}` }]
              };
            }
          }
        );

        this.server.tool(
          "xano_delete_file",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            file_id: z.union([z.string(), z.number()]).describe("The ID of the file to delete")
          },
          async ({ instance_name, workspace_id, file_id }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "🗑️ Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/workspace/${formatId(workspace_id)}/file/${formatId(file_id)}`;
              const result = await makeApiRequest(url, token, "DELETE", null, this.env);

              return {
                content: [{ type: "text", text: `🗑️ File Deleted - ID: ${file_id} | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  message: `File ${file_id} deleted successfully`,
                  file_id: file_id,
                  workspace_id: workspace_id,
                  data: result
                }, null, 2) }]
              };
            } catch (error) {
              return {
                content: [{ type: "text", text: `Error: ${error.message}` }]
              };
            }
          }
        );

        this.server.tool(
          "xano_list_workspace_branches",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace")
          },
          async ({ instance_name, workspace_id }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "🌿 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/workspace/${formatId(workspace_id)}/branch`;
              const result = await makeApiRequest(url, token, "GET", null, this.env);

              return {
                content: [{ type: "text", text: `🌿 Workspace Branches - ${Array.isArray(result) ? result.length : 0} branch(es) | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify(result, null, 2) }]
              };
            } catch (error) {
              return {
                content: [{ type: "text", text: `Error: ${error.message}` }]
              };
            }
          }
        );

        this.server.tool(
          "xano_delete_workspace_branch",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            branch_name: z.string().describe("The name of the branch to delete")
          },
          async ({ instance_name, workspace_id, branch_name }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "🌿 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/workspace/${formatId(workspace_id)}/branch/${encodeURIComponent(branch_name)}`;
              const result = await makeApiRequest(url, token, "DELETE", null, this.env);

              return {
                content: [{ type: "text", text: `🗑️ Branch Deleted - ${branch_name} | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  message: `Branch ${branch_name} deleted successfully`,
                  branch_name: branch_name,
                  workspace_id: workspace_id,
                  data: result
                }, null, 2) }]
              };
            } catch (error) {
              return {
                content: [{ type: "text", text: `Error: ${error.message}` }]
              };
            }
          }
        );

        this.server.tool(
          "xano_browse_api_groups",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            page: z.number().optional().describe("Page number (default: 1)"),
            per_page: z.number().optional().describe("Number of items per page (default: 50)")
          },
          async ({ instance_name, workspace_id, page = 1, per_page = 50 }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "📂 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const params = new URLSearchParams({
                page: page.toString(),
                per_page: per_page.toString()
              });

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/workspace/${formatId(workspace_id)}/apigroup?${params}`;
              const result = await makeApiRequest(url, token, "GET", null, this.env);

              return {
                content: [{ type: "text", text: `📂 API Groups - ${Array.isArray(result?.items) ? result.items.length : 0} group(s) | Page ${page}\n${"=".repeat(50)}\n` + JSON.stringify(result, null, 2) }]
              };
            } catch (error) {
              return {
                content: [{ type: "text", text: `Error: ${error.message}` }]
              };
            }
          }
        );

        this.server.tool(
          "xano_create_api_group",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            branch: z.string().optional().describe("Branch name"),
            name: z.string().describe("The name of the new API group"),
            description: z.string().optional().describe("Description of the API group"),
            docs: z.string().optional().describe("Documentation"),
            swagger: z.boolean().optional().describe("Enable swagger"),
            tag: z.array(z.string()).optional().describe("Tags for the API group")
          },
          {
            annotations: {
              title: "📁 Create API Group",
              readOnlyHint: false,
              destructiveHint: false,
              idempotentHint: false,
              openWorldHint: true
            }
          },
          async ({ instance_name, workspace_id, branch, name, description, docs, swagger, tag }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "📁 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const data = {
                ...(branch && { branch }),
                name,
                ...(description && { description }),
                ...(docs && { docs }),
                ...(swagger !== undefined && { swagger }),
                ...(tag && tag.length > 0 && { tag })
              };

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/workspace/${formatId(workspace_id)}/apigroup`;
              const result = await makeApiRequest(url, token, "POST", data, this.env);

              return {
                content: [{ type: "text", text: `📁 API Group Created - "${name}" | ID: ${result?.id || 'N/A'} | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  group_name: name,
                  group_id: result?.id,
                  workspace_id: workspace_id,
                  data: result
                }, null, 2) }]
              };
            } catch (error) {
              return {
                content: [{ type: "text", text: `Error: ${error.message}` }]
              };
            }
          }
        );

        this.server.tool(
          "xano_get_api_group",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            api_group_id: z.union([z.string(), z.number()]).describe("The ID of the API group")
          },
          {
            annotations: {
              title: "Get API Group",
              readOnlyHint: true,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: true
            }
          },
          async ({ instance_name, workspace_id, api_group_id }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "📂 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/workspace/${formatId(workspace_id)}/apigroup/${formatId(api_group_id)}`;
              const result = await makeApiRequest(url, token, "GET", null, this.env);

              return {
                content: [{ type: "text", text: `📂 API Group Details - "${result?.name || 'Unknown'}" | ID: ${api_group_id}\n${"=".repeat(50)}\n` + JSON.stringify(result, null, 2) }]
              };
            } catch (error) {
              return {
                content: [{ type: "text", text: `Error: ${error.message}` }]
              };
            }
          }
        );

        this.server.tool(
          "xano_update_api_group",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            api_group_id: z.union([z.string(), z.number()]).describe("The ID of the API group"),
            name: z.string().optional().describe("New name for the API group"),
            description: z.string().optional().describe("New description for the API group"),
            docs: z.string().optional().describe("Documentation"),
            swagger: z.boolean().optional().describe("Enable swagger"),
            tag: z.array(z.string()).optional().describe("Tags")
          },
          async ({ instance_name, workspace_id, api_group_id, name, description, docs, swagger, tag }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "📝 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const data: any = {};
              if (name) data.name = name;
              if (description) data.description = description;
              if (docs) data.docs = docs;
              if (swagger !== undefined) data.swagger = swagger;
              if (tag && tag.length > 0) data.tag = tag;

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/workspace/${formatId(workspace_id)}/apigroup/${formatId(api_group_id)}`;
              const result = await makeApiRequest(url, token, "PUT", data, this.env);

              return {
                content: [{ type: "text", text: `✏️ API Group Updated - ID: ${api_group_id} | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  api_group_id: api_group_id,
                  workspace_id: workspace_id,
                  data: result
                }, null, 2) }]
              };
            } catch (error) {
              return {
                content: [{ type: "text", text: `Error: ${error.message}` }]
              };
            }
          }
        );

        this.server.tool(
          "xano_delete_api_group",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            api_group_id: z.union([z.string(), z.number()]).describe("The ID of the API group to delete")
          },
          async ({instance_name, workspace_id, api_group_id}) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "🗑️ Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/workspace/${formatId(workspace_id)}/apigroup/${formatId(api_group_id)}`;
              const result = await makeApiRequest(url, token, "DELETE", null, this.env);

              return {
                content: [{ type: "text", text: `🗑️ API Group Deleted - ID: ${api_group_id} | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  message: `API group ${api_group_id} deleted successfully`,
                  api_group_id: api_group_id,
                  workspace_id: workspace_id,
                  data: result
                }, null, 2) }]
              };
            } catch (error) {
              return {
                content: [{ type: "text", text: `Error: ${error.message}` }]
              };
            }
          }
        );

        this.server.tool(
          "xano_browse_apis_in_group",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            api_group_id: z.union([z.string(), z.number()]).describe("The ID of the API group"),
            page: z.number().optional().describe("Page number (default: 1)"),
            per_page: z.number().optional().describe("Number of items per page (default: 50)")
          },
          async ({instance_name, workspace_id, api_group_id, page = 1, per_page = 50}) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "📄 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const params = new URLSearchParams({
                page: page.toString(),
                per_page: per_page.toString()
              });

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/workspace/${formatId(workspace_id)}/apigroup/${formatId(api_group_id)}/api?${params}`;
              const result = await makeApiRequest(url, token, "GET", null, this.env);

              return {
                content: [{ type: "text", text: `🔌 APIs in Group - ${Array.isArray(result?.items) ? result.items.length : 0} API(s) | Group ${api_group_id}\n${"=".repeat(50)}\n` + JSON.stringify(result, null, 2) }]
              };
            } catch (error) {
              return {
                content: [{ type: "text", text: `Error: ${error.message}` }]
              };
            }
          }
        );

        this.server.tool(
          "xano_create_api",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            api_group_id: z.union([z.string(), z.number()]).describe("The ID of the API group"),
            name: z.string().describe("The name of the new API"),
            description: z.string().optional().describe("Description of the API"),
            verb: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).describe("HTTP verb for the API"),
            path: z.string().optional().describe("URL path for the API endpoint"),
            docs: z.string().optional().describe("Documentation"),
            tag: z.array(z.string()).optional().describe("Tags")
          },
          async ({ instance_name, workspace_id, api_group_id, name, description, verb, path, docs, tag }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "🆕 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const data = {
                name,
                verb,
                ...(description && { description }),
                ...(path && { path }),
                ...(docs && { docs }),
                ...(tag && tag.length > 0 && { tag })
              };

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/workspace/${formatId(workspace_id)}/apigroup/${formatId(api_group_id)}/api`;
              const result = await makeApiRequest(url, token, "POST", data, this.env);

              return {
                content: [{ type: "text", text: `🆕 API Created - "${name}" | ${verb} | ID: ${result?.id || 'N/A'}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  api_name: name,
                  api_id: result?.id,
                  verb: verb,
                  api_group_id: api_group_id,
                  data: result
                }, null, 2) }]
              };
            } catch (error) {
              return {
                content: [{ type: "text", text: `Error: ${error.message}` }]
              };
            }
          }
        );

        this.server.tool(
          "xano_get_api",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            api_group_id: z.union([z.string(), z.number()]).describe("The ID of the API group"),
            api_id: z.union([z.string(), z.number()]).describe("The ID of the API")
          },
          async ({instance_name, workspace_id, api_group_id, api_id}) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "📄 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/workspace/${formatId(workspace_id)}/apigroup/${formatId(api_group_id)}/api/${formatId(api_id)}`;
              const result = await makeApiRequest(url, token, "GET", null, this.env);

              return {
                content: [{ type: "text", text: `🔌 API Details - "${result?.name || 'Unknown'}" | ${result?.verb || 'GET'} | ID: ${api_id}\n${"=".repeat(50)}\n` + JSON.stringify(result, null, 2) }]
              };
            } catch (error) {
              return {
                content: [{ type: "text", text: `Error: ${error.message}` }]
              };
            }
          }
        );

        this.server.tool(
          "xano_update_api",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            api_group_id: z.union([z.string(), z.number()]).describe("The ID of the API group"),
            api_id: z.union([z.string(), z.number()]).describe("The ID of the API"),
            name: z.string().optional().describe("New name for the API"),
            description: z.string().optional().describe("New description for the API"),
            verb: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).optional().describe("New HTTP verb"),
            path: z.string().optional().describe("New URL path"),
            docs: z.string().optional().describe("Documentation"),
            tag: z.array(z.string()).optional().describe("Tags")
          },
          async ({ instance_name, workspace_id, api_group_id, api_id, name, description, verb, path, docs, tag }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "🔄 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const data: any = {};
              if (name) data.name = name;
              if (description) data.description = description;
              if (verb) data.verb = verb;
              if (path) data.path = path;
              if (docs) data.docs = docs;
              if (tag && tag.length > 0) data.tag = tag;

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/workspace/${formatId(workspace_id)}/apigroup/${formatId(api_group_id)}/api/${formatId(api_id)}`;
              const result = await makeApiRequest(url, token, "PUT", data, this.env);

              return {
                content: [{ type: "text", text: `✏️ API Updated - ID: ${api_id} | Group ${api_group_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  api_id: api_id,
                  api_group_id: api_group_id,
                  data: result
                }, null, 2) }]
              };
            } catch (error) {
              return {
                content: [{ type: "text", text: `Error: ${error.message}` }]
              };
            }
          }
        );

        this.server.tool(
          "xano_delete_api",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            api_group_id: z.union([z.string(), z.number()]).describe("The ID of the API group"),
            api_id: z.union([z.string(), z.number()]).describe("The ID of the API to delete")
          },
          async ({instance_name, workspace_id, api_group_id, api_id}) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "🗑️ Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/workspace/${formatId(workspace_id)}/apigroup/${formatId(api_group_id)}/api/${formatId(api_id)}`;
              const result = await makeApiRequest(url, token, "DELETE", null, this.env);

              return {
                content: [{ type: "text", text: `🗑️ API Deleted - ID: ${api_id} | Group ${api_group_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  message: `API ${api_id} deleted successfully from group ${api_group_id}`,
                  api_id: api_id,
                  api_group_id: api_group_id,
                  data: result
                }, null, 2) }]
              };
            } catch (error) {
              return {
                content: [{ type: "text", text: `Error: ${error.message}` }]
              };
            }
          }
        );

        this.server.tool(
          "xano_export_workspace",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            include_data: z.boolean().optional().describe("Whether to include table data in export (default: false)")
          },
          async ({instance_name, workspace_id, include_data = false}) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "📦 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const data = {
                include_data
              };

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/workspace/${formatId(workspace_id)}/export`;
              const result = await makeApiRequest(url, token, "POST", data, this.env);

              return {
                content: [{ type: "text", text: `📤 Workspace Exported - ID: ${workspace_id} | Data included: ${include_data || false}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  message: "Workspace export completed successfully",
                  workspace_id: workspace_id,
                  include_data: include_data,
                  data: result
                }, null, 2) }]
              };
            } catch (error) {
              return {
                content: [{ type: "text", text: `Error: ${error.message}` }]
              };
            }
          }
        );

        this.server.tool(
          "xano_export_workspace_schema",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            branch: z.string().optional().describe("Branch name (leave empty for current live branch)"),
            password: z.string().optional().describe("Optional password to encrypt the export")
          },
          async ({instance_name, workspace_id, branch, password}) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "📋 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const data = {
                branch: branch || "",
                password: password || ""
              };

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/workspace/${formatId(workspace_id)}/export-schema`;
              const result = await makeApiRequest(url, token, "POST", data, this.env);

              return {
                content: [{ type: "text", text: `📤 Schema Exported - Workspace: ${workspace_id} | Branch: ${branch || 'live'}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  message: "Schema export completed successfully",
                  workspace_id: workspace_id,
                  branch: branch || 'live',
                  data: result
                }, null, 2) }]
              };
            } catch (error) {
              return {
                content: [{ type: "text", text: `Error: ${error.message}` }]
              };
            }
          }
        );

        this.server.tool(
          "xano_browse_request_history",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            page: z.number().optional().describe("Page number (default: 1)"),
            per_page: z.number().optional().describe("Number of requests per page (default: 50)"),
            start_date: z.string().optional().describe("Start date filter (YYYY-MM-DD format)"),
            end_date: z.string().optional().describe("End date filter (YYYY-MM-DD format)")
          },
          async ({instance_name, workspace_id, page = 1, per_page = 50, start_date, end_date}) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "📈 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const params = new URLSearchParams({
                page: page.toString(),
                per_page: per_page.toString()
              });

              if (start_date) params.append('start_date', start_date);
              if (end_date) params.append('end_date', end_date);

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/workspace/${formatId(workspace_id)}/request_history?${params}`;
              const result = await makeApiRequest(url, token, "GET", null, this.env);

              return {
                content: [{ type: "text", text: `📊 Request History - ${Array.isArray(result?.items) ? result.items.length : 0} request(s) | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify(result, null, 2) }]
              };
            } catch (error) {
              return {
                content: [{ type: "text", text: `Error: ${error.message}` }]
              };
            }
          }
        );

        this.server.tool(
          "xano_truncate_table",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
            reset: z.boolean().optional().describe("Whether to reset the primary key sequence (default: false)")
          },
          {
            annotations: {
              title: "Truncate Table",
              readOnlyHint: false,    // This modifies data
              destructiveHint: true,  // This destroys all data in the table
              idempotentHint: true,   // Truncating an empty table has no effect
              openWorldHint: true     // Interacts with external Xano API
            }
          },
          async ({ instance_name, workspace_id, table_id, reset = false }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "🗑️ Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/truncate`;
          
              // Truncate requires special x-data-source header
              const response = await fetch(url, {
                method: "DELETE",
                headers: {
                  "Authorization": `Bearer ${token}`,
                  "Content-Type": "application/json",
                  "x-data-source": "live"  // Required header for truncate
                },
                body: JSON.stringify({ reset }, null, 2)
              });

              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} - ${errorText}`);
              }

              const result = response.status === 204 ? {} : await response.json();

              return {
                content: [{ type: "text", text: `🧹 Table Truncated - ID: ${table_id} | Reset PK: ${reset}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  message: `Table ${table_id} truncated successfully`,
                  table_id: table_id,
                  reset_primary_key: reset,
                  data: result
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: {
                      message: `Error truncating table: ${error.message}`,
                      code: "EXCEPTION"
                    },
                    operation: "xano_truncate_table"
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_create_btree_index",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
            fields: z.array(z.object({
              name: z.string().describe("Field name to index"),
              op: z.enum(["asc", "desc"]).optional().describe("Sort order (default: asc)")
            })).describe("List of fields to create the index on")
          },
          {
            annotations: {
              title: "Create BTree Index",
              readOnlyHint: false,    // This creates an index
              destructiveHint: false, // Doesn't destroy data
              idempotentHint: false,  // Creating same index twice would fail
              openWorldHint: true     // Interacts with external Xano API
            }
          },
          async ({ instance_name, workspace_id, table_id, fields }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "🗂️ Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/index/btree`;
              const result = await makeApiRequest(url, token, "POST", { fields }, this.env);

              return {
                content: [{ type: "text", text: `🗂️ BTree Index Created - Table ${table_id} | ${fields.length} field(s)\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  table_id: table_id,
                  indexed_fields: fields,
                  data: result
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                "🔍 INDEX CREATED": true,
                    success: false,
                    error: {
                      message: `Error creating BTree index: ${error.message}`,
                      code: error.response?.code || "EXCEPTION"
                    },
                    operation: "xano_create_btree_index"
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_list_functions",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            branch: z.string().optional().describe("Branch name"),
            include_draft: z.boolean().optional().describe("Include draft functions"),
            page: z.number().optional().describe("Page number (default: 1)"),
            per_page: z.number().optional().describe("Items per page (default: 50)"),
            search: z.string().optional().describe("Search term"),
            sort: z.enum(["created_at", "updated_at", "name"]).optional().describe("Sort by field"),
            order: z.enum(["asc", "desc"]).optional().describe("Sort order")
          },
          {
            annotations: {
              title: "List Functions",
              readOnlyHint: true,     // This is read-only
              destructiveHint: false, // Doesn't destroy data
              idempotentHint: true,   // Same query returns same results
              openWorldHint: true     // Interacts with external Xano API
            }
          },
          async ({ instance_name, workspace_id, branch, include_draft, page = 1, per_page = 50, search, sort, order }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "⚙️ Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const params = new URLSearchParams({
                page: page.toString(),
                per_page: per_page.toString()
              });
          
              if (branch) params.append("branch", branch);
              if (include_draft !== undefined) params.append("include_draft", include_draft.toString());
              if (search) params.append("search", search);
              if (sort) params.append("sort", sort);
              if (order) params.append("order", order);

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/beta/workspace/${formatId(workspace_id)}/function?${params.toString()}`;
              const result = await makeApiRequest(url, token, "GET", null, this.env);

              return {
                content: [{ type: "text", text: `⚡ Functions List - ${Array.isArray(result?.items) ? result.items.length : 0} function(s) | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  functions: result,
                  workspace_id: workspace_id,
                  count: Array.isArray(result?.items) ? result.items.length : 0,
                  quick_reference: {
                    create_new: "Use xano_create_function with type='xs' and XanoScript",
                    view_code: "Use xano_get_function_details to see full XanoScript"
                  }
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                "⚡ FUNCTIONS": true,
                    success: false,
                    error: {
                      message: `Error listing functions: ${error.message}`,
                      code: error.response?.code || "EXCEPTION"
                    },
                    operation: "xano_list_functions"
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_create_function",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            branch: z.string().optional().describe("Branch name"),
            type: z.enum(["xs", "yaml", "json"]).optional().default("xs").describe("Function type - always use 'xs' for XanoScript"),
            script: z.string().describe(`Complete XanoScript function code. Example working syntax:
    function my_function {
      description = "Function description"
      input {
        email email_field {
          description = "Email to validate"
        }
        text name_field {
          description = "User name"
        }
      }
      stack {
        precondition ($input.email_field != "") {
          error = "Email is required"
        }
    
        api.request {
          url = "https://api.example.com/validate"
          method = "POST"
          params = {}|set:"email":$input.email_field
          headers = []|push:"Authorization: Bearer token"
          description = "Validate email"
        } as $api_response
      }
      response {
        value = $api_response.response.result
      }
    }`)
          },
          {
            annotations: {
              title: "Create Function",
              readOnlyHint: false,    // This creates a function
              destructiveHint: false, // Doesn't destroy data
              idempotentHint: false,  // Creating same function twice would fail
              openWorldHint: true     // Interacts with external Xano API
            }
          },
          async ({ instance_name, workspace_id, branch, type = "xs", script }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "⚙️ Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const data = {
                type,
                script,
                ...(branch && { branch })
              };

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/beta/workspace/${formatId(workspace_id)}/function`;
              const result = await makeApiRequest(url, token, "POST", data, this.env);

              return {
                content: [{ type: "text", text: `⚡ Function Created - ID: ${result?.id || 'N/A'} | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  function_id: result?.id,
                  workspace_id: workspace_id,
                  script_type: type,
                  data: result,
                  tips: [
                    "Functions use 'function name { }' syntax",
                    "Always verify syntax with xano_get_function_details after creation"
                  ]
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                "➕ FUNCTION CREATED": true,
                    success: false,
                    error: {
                      message: `Error creating function: ${error.message}`,
                      code: error.response?.code || "EXCEPTION"
                    },
                    operation: "xano_create_function",
                    syntax_help: {
                      correct_structure: "function name { description = \"desc\" input { } stack { } response { } }",
                      common_mistakes: [
                        "Using 'api' instead of 'function' keyword",
                        "Missing response block",
                        "Using // for comments (not supported)",
                        "Wrong input field types"
                      ],
                      tip: "Use xano_get_function_details on an existing function to see working syntax"
                    }
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_get_function_details",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            function_id: z.union([z.string(), z.number()]).describe("The ID of the function"),
            include_draft: z.boolean().optional().describe("Include draft version")
          },
          {
            annotations: {
              title: "Get Function Details",
              readOnlyHint: true,     // This is read-only
              destructiveHint: false, // Doesn't destroy data
              idempotentHint: true,   // Same query returns same results
              openWorldHint: true     // Interacts with external Xano API
            }
          },
          async ({ instance_name, workspace_id, function_id, include_draft }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "⚙️ Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const params = new URLSearchParams();
              if (include_draft !== undefined) params.append("include_draft", include_draft.toString());

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/beta/workspace/${formatId(workspace_id)}/function/${formatId(function_id)}${params.toString() ? '?' + params.toString() : ''}`;
              const result = await makeApiRequest(url, token, "GET", null, this.env);

              return {
                content: [{ type: "text", text: `⚡ Function Details - "${result?.name || 'Unknown'}" | ID: ${function_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  function_details: result,
                  function_id: function_id,
                  workspace_id: workspace_id,
                  analysis_tip: "Study the 'script' field to understand XanoScript patterns"
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                "⚡ FUNCTION DETAILS": true,
                    success: false,
                    error: {
                      message: `Error getting function details: ${error.message}`,
                      code: error.response?.code || "EXCEPTION"
                    },
                    operation: "xano_get_function_details"
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_delete_function",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            function_id: z.union([z.string(), z.number()]).describe("The ID of the function to delete")
          },
          {
            annotations: {
              title: "Delete Function",
              readOnlyHint: false,    // This deletes a function
              destructiveHint: true,  // This destroys the function
              idempotentHint: true,   // Deleting non-existent function has no effect
              openWorldHint: true     // Interacts with external Xano API
            }
          },
          async ({ instance_name, workspace_id, function_id }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "❌ Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/beta/workspace/${formatId(workspace_id)}/function/${formatId(function_id)}`;
              const result = await makeApiRequest(url, token, "DELETE", null, this.env);

              return {
                content: [{ type: "text", text: `🗑️ Function Deleted - ID: ${function_id} | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  message: `Function ${function_id} deleted successfully`,
                  function_id: function_id,
                  workspace_id: workspace_id,
                  data: result
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: {
                      message: `Error deleting function: ${error.message}`,
                      code: error.response?.code || "EXCEPTION"
                    },
                    operation: "xano_delete_function"
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_create_search_index",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
            name: z.string().describe("Name for the search index"),
            fields: z.array(z.object({
              name: z.string().describe("Field name"),
              priority: z.number().optional().default(1).describe("Search priority (default: 1)")
            })).describe("List of fields to create the search index on"),
            lang: z.enum(["english", "spanish", "french", "german", "italian", "portuguese", "russian", "chinese", "japanese", "korean"]).optional().default("english").describe("Language for text analysis (default: english)")
          },
          {
            annotations: {
              title: "Create Search Index",
              readOnlyHint: false,    // This creates an index
              destructiveHint: false, // Doesn't destroy data
              idempotentHint: false,  // Creating same index twice would fail
              openWorldHint: true     // Interacts with external Xano API
            }
          },
          async ({ instance_name, workspace_id, table_id, name, fields, lang = "english" }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "🔍 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}/index/search`;
              const result = await makeApiRequest(url, token, "POST", { name, lang, fields }, this.env);

              return {
                content: [{ type: "text", text: `🔍 Search Index Created - "${name}" | Table ${table_id} | Language: ${lang}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  index_name: name,
                  table_id: table_id,
                  language: lang,
                  fields: fields,
                  data: result
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                "🔍 SEARCH INDEX": true,
                    success: false,
                    error: {
                      message: `Error creating search index: ${error.message}`,
                      code: error.response?.code || "EXCEPTION"
                    },
                    operation: "xano_create_search_index"
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_create_api_with_logic",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            api_group_id: z.union([z.string(), z.number()]).describe("The ID of the API group"),
            type: z.enum(["xs", "yaml", "json"]).default("xs").describe("Script type - always use 'xs' for XanoScript"),
            script: z.string().describe(`Complete XanoScript API endpoint code. Example working syntax:
    query create_user verb=POST {
      input {
        email email_address {
          description = "User's email address"
        }
        text first_name {
          description = "User's first name"
        }
        text password {
          description = "User's password"
        }
      }
  
      stack {
        precondition ($input.email_address != "") {
          error = "Email is required"
        }
    
        precondition ($input.password != "") {
          error = "Password is required"
        }
    
        api.request {
          url = "https://api.example.com/validate-email"
          method = "POST"
          params = {}|set:"email":$input.email_address
          headers = []|push:"Content-Type: application/json"
          description = "Validate email format"
        } as $validation
      }
  
      response {
        value = {
          success: true,
          email: $input.email_address,
          name: $input.first_name,
          validated: $validation.response.status == 200
        }
      }
    }

    IMPORTANT: Use 'query' keyword for APIs, not 'function'. Specify verb=GET/POST/PUT/DELETE.`)
          },
          {
            annotations: {
              title: "Create API with Full Logic",
              readOnlyHint: false,
              destructiveHint: false,
              idempotentHint: false,
              openWorldHint: true
            }
          },
          async ({ instance_name, workspace_id, api_group_id, type = "xs", script }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "🧠 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const data = {
                type,
                script
              };

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/beta/workspace/${formatId(workspace_id)}/apigroup/${formatId(api_group_id)}/api`;
              const result = await makeApiRequest(url, token, "POST", data, this.env);

              return {
                content: [{ type: "text", text: `🧠 API Created with Logic - ID: ${result?.id || 'N/A'} | Group ${api_group_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  message: "API endpoint created successfully with full XanoScript logic",
                  api_id: result?.id,
                  api_group_id: api_group_id,
                  workspace_id: workspace_id,
                  script_type: type,
                  data: result,
                  verification_tip: "Use xano_get_api_with_logic to verify syntax after creation"
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: {
                      message: `Error creating API with logic: ${error.message}`,
                      code: "EXCEPTION"
                    },
                    operation: "xano_create_api_with_logic",
                    syntax_help: {
                      correct_structure: "query endpoint_name verb=POST { input { } stack { } response { } }",
                      common_mistakes: [
                        "Using 'function' instead of 'query' keyword",
                        "Missing verb specification (verb=GET/POST/PUT/DELETE)",
                        "Invalid JSON in response block",
                        "Using database operations (not supported in beta)"
                      ],
                      tip: "Use xano_get_api_with_logic on existing API to see working syntax"
                    }
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_create_task",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            branch: z.string().optional().describe("Branch name"),
            type: z.enum(["xs", "yaml", "json"]).default("xs").describe("Script type - always use 'xs' for XanoScript"),
            script: z.string().describe(`Complete XanoScript background task code. Example working syntax:
    task "health_check_task" {
      active = true
      history = {limit: 50, inherit: true}
  
      stack {
        api.request {
          url = "https://api.example.com/health"
          method = "GET"
          headers = []
          description = "Check API health"
        } as $health_check
    
        precondition ($health_check.response.status == 200) {
          error = "Health check failed"
        }
      }
  
      schedule {
        events = []  // Add cron expressions here like "0 */5 * * *" for every 5 minutes
      }
    }

    IMPORTANT: Tasks use 'task "name"' format with quoted name. Must include active, history, and schedule blocks.`)
          },
          {
            annotations: {
              title: "Create Background Task",
              readOnlyHint: false,
              destructiveHint: false,
              idempotentHint: false,
              openWorldHint: true
            }
          },
          async ({ instance_name, workspace_id, branch, type = "xs", script }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "📋 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const data = {
                type,
                script,
                ...(branch && { branch })
              };

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/beta/workspace/${formatId(workspace_id)}/task`;
              const result = await makeApiRequest(url, token, "POST", data, this.env);

              return {
                content: [{ type: "text", text: `📋 Task Created - ID: ${result?.id || 'N/A'} | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  message: "Background task created successfully with XanoScript logic",
                  task_id: result?.id,
                  workspace_id: workspace_id,
                  script_type: type,
                  data: result,
                  tips: [
                    "Tasks use 'task \"name\" { }' syntax with quoted name",
                    "Required blocks: active, history, schedule",
                    "Always test with xano_get_task_details after creation"
                  ]
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: {
                      message: `Error creating task: ${error.message}`,
                      code: "EXCEPTION"
                    },
                    operation: "xano_create_task",
                    syntax_help: {
                      correct_structure: "task \"task_name\" { active = true history = {limit: 50, inherit: true} stack { } schedule { events = [] } }",
                      common_mistakes: [
                        "Missing quotes around task name",
                        "Missing required blocks: active, history, schedule",
                        "Using input/response blocks (tasks don't have these)",
                        "Invalid cron expression in schedule.events"
                      ],
                      cron_examples: [
                        "\"0 * * * *\" = Every hour",
                        "\"0 0 * * *\" = Daily at midnight",
                        "\"0 0 * * 0\" = Weekly on Sunday",
                        "\"*/15 * * * *\" = Every 15 minutes"
                      ],
                      tip: "Use xano_get_task_details on existing task to see working syntax"
                    }
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_get_api_with_logic",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            api_group_id: z.union([z.string(), z.number()]).describe("The ID of the API group"),
            api_id: z.union([z.string(), z.number()]).describe("The ID of the API"),
            include_draft: z.boolean().optional().describe("Include draft version"),
            type: z.enum(["xs", "yaml", "json"]).optional().describe("Format to retrieve the logic in")
          },
          {
            annotations: {
              title: "Get API Details with Logic",
              readOnlyHint: true,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: true
            }
          },
          async ({ instance_name, workspace_id, api_group_id, api_id, include_draft, type }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "🧠 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const params = new URLSearchParams();
              if (include_draft !== undefined) params.append("include_draft", include_draft.toString());
              if (type) params.append("type", type);

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/beta/workspace/${formatId(workspace_id)}/apigroup/${formatId(api_group_id)}/api/${formatId(api_id)}${params.toString() ? '?' + params.toString() : ''}`;
              const result = await makeApiRequest(url, token, "GET", null, this.env);

              return {
                content: [{ type: "text", text: `🧠 API Logic Details - "${result?.name || 'Unknown'}" | ${result?.verb || 'GET'} | ID: ${api_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  api_details: result,
                  api_id: api_id,
                  api_group_id: api_group_id,
                  workspace_id: workspace_id,
                  analysis_tip: "Study the 'script' field to learn API patterns"
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                "🔌 API LOGIC": true,
                    success: false,
                    error: {
                      message: `Error getting API with logic: ${error.message}`,
                      code: "EXCEPTION"
                    },
                    operation: "xano_get_api_with_logic"
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_update_api_with_logic",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            api_group_id: z.union([z.string(), z.number()]).describe("The ID of the API group"),
            api_id: z.union([z.string(), z.number()]).describe("The ID of the API to update"),
            type: z.enum(["xs", "yaml", "json"]).default("xs").describe("Script type - use 'xs' for XanoScript"),
            script: z.string().describe("Updated XanoScript code for the API")
          },
          {
            annotations: {
              title: "Update API Logic",
              readOnlyHint: false,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: true
            }
          },
          async ({ instance_name, workspace_id, api_group_id, api_id, type = "xs", script }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "🧠 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const data = {
                type,
                script
              };

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/beta/workspace/${formatId(workspace_id)}/apigroup/${formatId(api_group_id)}/api/${formatId(api_id)}`;
              const result = await makeApiRequest(url, token, "PUT", data, this.env);

              return {
                content: [{ type: "text", text: `✏️ API Logic Updated - ID: ${api_id} | Group ${api_group_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  message: "API logic updated successfully",
                  api_id: api_id,
                  api_group_id: api_group_id,
                  workspace_id: workspace_id,
                  script_type: type,
                  data: result
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: {
                      message: `Error updating API logic: ${error.message}`,
                      code: "EXCEPTION"
                    },
                    operation: "xano_update_api_with_logic"
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_list_tasks",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            branch: z.string().optional().describe("Branch name"),
            include_draft: z.boolean().optional().describe("Include draft tasks"),
            page: z.number().optional().describe("Page number (default: 1)"),
            per_page: z.number().optional().describe("Items per page (default: 50)"),
            search: z.string().optional().describe("Search term"),
            sort: z.enum(["created_at", "updated_at", "name"]).optional().describe("Sort by field"),
            order: z.enum(["asc", "desc"]).optional().describe("Sort order")
          },
          {
            annotations: {
              title: "List Background Tasks",
              readOnlyHint: true,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: true
            }
          },
          async ({ instance_name, workspace_id, branch, include_draft, page = 1, per_page = 50, search, sort, order }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "📋 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const params = new URLSearchParams({
                page: page.toString(),
                per_page: per_page.toString()
              });
          
              if (branch) params.append("branch", branch);
              if (include_draft !== undefined) params.append("include_draft", include_draft.toString());
              if (search) params.append("search", search);
              if (sort) params.append("sort", sort);
              if (order) params.append("order", order);

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/beta/workspace/${formatId(workspace_id)}/task?${params.toString()}`;
              const result = await makeApiRequest(url, token, "GET", null, this.env);

              return {
                content: [{ type: "text", text: `📋 Tasks List - ${Array.isArray(result?.items) ? result.items.length : 0} task(s) | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  tasks: result,
                  workspace_id: workspace_id,
                  count: Array.isArray(result?.items) ? result.items.length : 0,
                  quick_reference: {
                    create_new: "Use xano_create_task with type='xs' and XanoScript",
                    view_code: "Use xano_get_task_details to see full XanoScript"
                  }
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                "⏰ TASKS": true,
                    success: false,
                    error: {
                      message: `Error listing tasks: ${error.message}`,
                      code: "EXCEPTION"
                    },
                    operation: "xano_list_tasks"
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_get_task_details",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            task_id: z.union([z.string(), z.number()]).describe("The ID of the task"),
            include_draft: z.boolean().optional().describe("Include draft version"),
            type: z.enum(["xs", "yaml", "json"]).optional().describe("Format to retrieve the logic in")
          },
          {
            annotations: {
              title: "Get Task Details",
              readOnlyHint: true,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: true
            }
          },
          async ({ instance_name, workspace_id, task_id, include_draft, type }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "📋 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const params = new URLSearchParams();
              if (include_draft !== undefined) params.append("include_draft", include_draft.toString());
              if (type) params.append("type", type);

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/beta/workspace/${formatId(workspace_id)}/task/${formatId(task_id)}${params.toString() ? '?' + params.toString() : ''}`;
              const result = await makeApiRequest(url, token, "GET", null, this.env);

              return {
                content: [{ type: "text", text: `📋 Task Details - "${result?.name || 'Unknown'}" | ID: ${task_id} | Active: ${result?.active || false}\n${"=".repeat(50)}\n` + JSON.stringify({
                  task_details: result,
                  task_id: task_id,
                  workspace_id: workspace_id,
                  analysis_tip: "Study the 'script' field to understand task patterns"
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                "⏰ TASK DETAILS": true,
                    success: false,
                    error: {
                      message: `Error getting task details: ${error.message}`,
                      code: "EXCEPTION"
                    },
                    operation: "xano_get_task_details"
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_delete_task",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            task_id: z.union([z.string(), z.number()]).describe("The ID of the task to delete")
          },
          {
            annotations: {
              title: "Delete Background Task",
              readOnlyHint: false,
              destructiveHint: true,
              idempotentHint: true,
              openWorldHint: true
            }
          },
          async ({ instance_name, workspace_id, task_id }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "🗑️ Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/beta/workspace/${formatId(workspace_id)}/task/${formatId(task_id)}`;
              const result = await makeApiRequest(url, token, "DELETE", null, this.env);

              return {
                content: [{ type: "text", text: `🗑️ Task Deleted - ID: ${task_id} | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  message: `Task ${task_id} deleted successfully`,
                  task_id: task_id,
                  workspace_id: workspace_id,
                  data: result
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: {
                      message: `Error deleting task: ${error.message}`,
                      code: "EXCEPTION"
                    },
                    operation: "xano_delete_task"
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_publish_function",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            function_id: z.union([z.string(), z.number()]).describe("The ID of the function to publish"),
            type: z.enum(["xs", "yaml", "json"]).optional().default("xs").describe("Script type - always use 'xs' for XanoScript")
          },
          {
            annotations: {
              title: "Publish Function to Live",
              readOnlyHint: false,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: true
            }
          },
          async ({ instance_name, workspace_id, function_id, type = "xs" }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "🚀 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/beta/workspace/${formatId(workspace_id)}/function/${formatId(function_id)}/publish`;
              const result = await makeApiRequest(url, token, "POST", { type }, this.env);

              return {
                content: [{ type: "text", text: `🚀 Function Published - ID: ${function_id} | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  message: `Function ${function_id} published to live successfully`,
                  data: result,
                  operation: "xano_publish_function",
                  workflow_tips: [
                    "Draft changes are now live and accessible",
                    "Test your function endpoint to verify it's working",
                    "Use xano_get_function_details to see the published version",
                    "Future updates will create new drafts until published again"
                  ],
                  important: "Publishing makes changes immediately available to all API consumers"
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: {
                      message: `Error publishing function: ${error.message}`,
                      code: "EXCEPTION"
                    },
                    operation: "xano_publish_function",
                    troubleshooting: [
                      "Ensure the function has draft changes to publish",
                      "Verify the function_id exists",
                      "Check that you have update permissions",
                      "Use xano_get_function_details with include_draft=true to see draft status"
                    ]
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_publish_api",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            api_group_id: z.union([z.string(), z.number()]).describe("The ID of the API group"),
            api_id: z.union([z.string(), z.number()]).describe("The ID of the API to publish"),
            type: z.enum(["xs", "yaml", "json"]).optional().default("xs").describe("Script type - always use 'xs' for XanoScript")
          },
          {
            annotations: {
              title: "Publish API to Live",
              readOnlyHint: false,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: true
            }
          },
          async ({ instance_name, workspace_id, api_group_id, api_id, type = "xs" }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "🚀 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/beta/workspace/${formatId(workspace_id)}/apigroup/${formatId(api_group_id)}/api/${formatId(api_id)}/publish`;
              const result = await makeApiRequest(url, token, "POST", { type }, this.env);

              return {
                content: [{ type: "text", text: `🚀 API Published - ID: ${api_id} | Group ${api_group_id} | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  message: `API ${api_id} published to live successfully`,
                  data: result,
                  operation: "xano_publish_api",
                  endpoint_info: result.endpoint ? `Live at: ${instance_name}.xano.io${result.endpoint}` : "Check API group for endpoint",
                  workflow_tips: [
                    "API endpoint is now live and serving traffic",
                    "Test your endpoint with real requests",
                    "Monitor for any errors in production",
                    "Future updates create drafts until published"
                  ],
                  important: "Published APIs serve live traffic immediately"
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: {
                      message: `Error publishing API: ${error.message}`,
                      code: "EXCEPTION"
                    },
                    operation: "xano_publish_api",
                    troubleshooting: [
                      "Ensure the API has draft changes to publish",
                      "Verify api_id exists in the api_group_id",
                      "Check update permissions for the workspace",
                      "Use xano_get_api_with_logic with include_draft=true to check status"
                    ]
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_publish_task",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            task_id: z.union([z.string(), z.number()]).describe("The ID of the task to publish"),
            type: z.enum(["xs", "yaml", "json"]).optional().default("xs").describe("Script type - always use 'xs' for XanoScript")
          },
          {
            annotations: {
              title: "Publish Task to Live",
              readOnlyHint: false,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: true
            }
          },
          async ({ instance_name, workspace_id, task_id, type = "xs" }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "🚀 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/beta/workspace/${formatId(workspace_id)}/task/${formatId(task_id)}/publish`;
              const result = await makeApiRequest(url, token, "POST", { type }, this.env);

              return {
                content: [{ type: "text", text: `🚀 Task Published - ID: ${task_id} | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  message: `Task ${task_id} published to live successfully`,
                  data: result,
                  operation: "xano_publish_task",
                  workflow_tips: [
                    "Task schedule is now active (if active=true)",
                    "Check task execution history for runs",
                    "Monitor task logs for any errors",
                    "Future updates create drafts until published"
                  ],
                  schedule_info: result.schedule ? `Running on schedule: ${JSON.stringify(result.schedule, null, 2)}` : "No schedule defined",
                  important: "Published tasks run according to their schedule immediately"
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: {
                      message: `Error publishing task: ${error.message}`,
                      code: "EXCEPTION"
                    },
                    operation: "xano_publish_task",
                    troubleshooting: [
                      "Ensure the task has draft changes to publish",
                      "Verify the task_id exists",
                      "Check task permissions in workspace",
                      "Use xano_get_task_details with include_draft=true to check status"
                    ]
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_update_function",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            function_id: z.union([z.string(), z.number()]).describe("The ID of the function to update"),
            type: z.enum(["xs", "yaml", "json"]).optional().default("xs").describe("Script type - always use 'xs' for XanoScript"),
            script: z.string().describe(`Updated XanoScript function code. Example:
    function updated_function {
      description = "Updated function description"
      input {
        email email_field {
          description = "Email to process"
        }
      }
      stack {
        precondition ($input.email_field != "") {
          error = "Email is required"
        }
    
        api.request {
          url = "https://api.example.com/process"
          method = "POST"
          params = {}|set:"email":$input.email_field
          headers = []
          description = "Process email"
        } as $result
      }
      response {
        value = $result.response.data
      }
    }`)
          },
          {
            annotations: {
              title: "Update Function as Draft",
              readOnlyHint: false,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: true
            }
          },
          async ({ instance_name, workspace_id, function_id, type = "xs", script }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "⚙️ Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/beta/workspace/${formatId(workspace_id)}/function/${formatId(function_id)}`;
              const result = await makeApiRequest(url, token, "PUT", { type, script }, this.env);

              return {
                content: [{ type: "text", text: `✏️ Function Updated - ID: ${function_id} | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  message: `Function ${function_id} updated as draft successfully`,
                  data: result,
                  operation: "xano_update_function",
                  draft_status: "Changes saved as draft - NOT live yet",
                  next_steps: [
                    "Test the draft version before publishing",
                    "Use xano_get_function_details with include_draft=true to see draft",
                    "Use xano_publish_function to make changes live",
                    "Draft changes won't affect live function until published"
                  ],
                  syntax_reminder: {
                    structure: "function name { description input { } stack { } response { } }",
                    field_types: ["email", "text", "int", "bool", "decimal", "timestamp"],
                    key_patterns: "precondition for validation, api.request for external calls"
                  }
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: {
                      message: `Error updating function: ${error.message}`,
                      code: "EXCEPTION"
                    },
                    operation: "xano_update_function",
                    syntax_help: {
                      correct_structure: "function name { description = \"desc\" input { } stack { } response { } }",
                      common_mistakes: [
                        "Using 'api' instead of 'function' keyword",
                        "Missing required blocks",
                        "Invalid field types in input",
                        "Syntax errors in XanoScript"
                      ],
                      tip: "Get existing function with xano_get_function_details to see current syntax"
                    }
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_update_task",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            task_id: z.union([z.string(), z.number()]).describe("The ID of the task to update"),
            type: z.enum(["xs", "yaml", "json"]).optional().default("xs").describe("Script type - always use 'xs' for XanoScript"),
            script: z.string().describe(`Updated XanoScript task code. Example:
    task "updated_task" {
      active = true
      history = {limit: 100, inherit: true}
  
      stack {
        api.request {
          url = "https://api.example.com/monitor"
          method = "GET"
          headers = []
          description = "Monitor system health"
        } as $health_status
    
        precondition ($health_status.response.status == 200) {
          error = "Health check failed"
        }
      }
  
      schedule {
        events = ["*/10 * * * *"]  // Every 10 minutes
      }
    }`)
          },
          {
            annotations: {
              title: "Update Task as Draft",
              readOnlyHint: false,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: true
            }
          },
          async ({ instance_name, workspace_id, task_id, type = "xs", script }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "📝 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/beta/workspace/${formatId(workspace_id)}/task/${formatId(task_id)}`;
              const result = await makeApiRequest(url, token, "PUT", { type, script }, this.env);

              return {
                content: [{ type: "text", text: `✏️ Task Updated - ID: ${task_id} | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  message: `Task ${task_id} updated as draft successfully`,
                  data: result,
                  operation: "xano_update_task",
                  draft_status: "Changes saved as draft - NOT live yet",
                  next_steps: [
                    "Test the draft task logic",
                    "Use xano_get_task_details with include_draft=true to see draft",
                    "Use xano_publish_task to make changes live",
                    "Current live task continues running unchanged"
                  ],
                  syntax_reminder: {
                    structure: "task \"name\" { active history stack { } schedule { } }",
                    no_input_output: "Tasks don't have input or response blocks",
                    cron_examples: {
                      "every_5_min": "*/5 * * * *",
                      "hourly": "0 * * * *",
                      "daily": "0 0 * * *"
                    }
                  }
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: {
                      message: `Error updating task: ${error.message}`,
                      code: "EXCEPTION"
                    },
                    operation: "xano_update_task",
                    syntax_help: {
                      correct_structure: "task \"task_name\" { active = true history = {limit: 50, inherit: true} stack { } schedule { events = [] } }",
                      common_mistakes: [
                        "Missing quotes around task name",
                        "Missing required blocks: active, history, schedule",
                        "Using input/response blocks (tasks don't have these)",
                        "Invalid cron expression in schedule.events"
                      ],
                      tip: "Get existing task with xano_get_task_details to see current syntax"
                    }
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_activate_task",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            task_id: z.union([z.string(), z.number()]).describe("The ID of the task to activate/deactivate"),
            active: z.boolean().describe("Set to true to activate, false to deactivate the task")
          },
          {
            annotations: {
              title: "Activate/Deactivate Task",
              readOnlyHint: false,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: true
            }
          },
          async ({ instance_name, workspace_id, task_id, active }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "▶️ Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/beta/workspace/${formatId(workspace_id)}/task/${formatId(task_id)}/activate`;
              const result = await makeApiRequest(url, token, "PUT", { active }, this.env);

              return {
                content: [{ type: "text", text: `${active ? '▶️' : '⏸️'} Task ${active ? 'Activated' : 'Deactivated'} - ID: ${task_id} | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  message: `Task ${task_id} ${active ? 'activated' : 'deactivated'} successfully`,
                  data: result,
                  operation: "xano_activate_task",
                  status: active ? "Task is now running on schedule" : "Task is paused and won't run",
                  draft_note: "This creates a draft change - use xano_publish_task to make it live",
                  tips: [
                    active ? "Task will execute according to its schedule" : "Task won't run until reactivated",
                    "Check task history to monitor executions",
                    "This doesn't affect the task logic, only its active state"
                  ]
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: {
                      message: `Error ${active ? 'activating' : 'deactivating'} task: ${error.message}`,
                      code: "EXCEPTION"
                    },
                    operation: "xano_activate_task",
                    troubleshooting: [
                      "Verify the task_id exists",
                      "Check task permissions",
                      "Use xano_get_task_details to see current active state"
                    ]
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_list_apis_with_logic",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            api_group_id: z.union([z.string(), z.number()]).describe("The ID of the API group"),
            include_draft: z.boolean().optional().describe("Include draft versions"),
            page: z.number().optional().describe("Page number (default: 1)"),
            per_page: z.number().optional().describe("Number of results per page (default: 50)"),
            search: z.string().optional().describe("Search term to filter APIs"),
            sort: z.enum(["created_at", "updated_at", "name"]).optional().describe("Sort field"),
            order: z.enum(["asc", "desc"]).optional().describe("Sort order"),
            type: z.enum(["xs", "yaml", "json"]).optional().describe("Script type filter")
          },
          {
            annotations: {
              title: "List APIs with Logic",
              readOnlyHint: true,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: true
            }
          },
          async ({ 
            instance_name, workspace_id, api_group_id, include_draft, 
            page = 1, per_page = 50, search, sort, order, type 
          }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "🧠 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const params = new URLSearchParams({
                page: page.toString(),
                per_page: per_page.toString()
              });
          
              if (include_draft !== undefined) params.append("include_draft", include_draft.toString());
              if (search) params.append("search", search);
              if (sort) params.append("sort", sort);
              if (order) params.append("order", order);
              if (type) params.append("type", type);

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/beta/workspace/${formatId(workspace_id)}/apigroup/${formatId(api_group_id)}/api?${params.toString()}`;
              const result = await makeApiRequest(url, token, "GET", null, this.env);

              return {
                content: [{ type: "text", text: `🧠 APIs with Logic - ${Array.isArray(result?.items) ? result.items.length : 0} API(s) | Group ${api_group_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  data: result,
                  operation: "xano_list_apis_with_logic",
                  quick_actions: {
                    view_details: "Use xano_get_api_with_logic to see full XanoScript",
                    update_api: "Use xano_update_api_with_logic to modify as draft",
                    publish_api: "Use xano_publish_api to make draft changes live",
                    create_new: "Use xano_create_api_with_logic to add new API"
                  },
                  api_patterns: {
                    structure: "query name verb=METHOD { input { } stack { } response { } }",
                    verbs: ["GET", "POST", "PUT", "DELETE", "PATCH"],
                    tip: "APIs with draft=true have unpublished changes"
                  }
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                "🔌 API LIST": true,
                    success: false,
                    error: {
                      message: `Error listing APIs: ${error.message}`,
                      code: "EXCEPTION"
                    },
                    operation: "xano_list_apis_with_logic"
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_create_table_with_script",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            type: z.enum(["xs", "yaml", "json"]).optional().default("xs").describe("Script type - always use 'xs' for XanoScript"),
            script: z.string().describe(`Complete XanoScript table definition. Example:
    table users {
      description = "User accounts table"
  
      field id {
        type = "int"
        primary_key = true
        auto_increment = true
      }
  
      field email {
        type = "email"
        unique = true
        required = true
        description = "User's email address"
      }
  
      field password {
        type = "password"
        required = true
        description = "Hashed password"
      }
  
      field first_name {
        type = "text"
        required = true
        max_length = 100
      }
  
      field last_name {
        type = "text"
        required = true
        max_length = 100
      }
  
      field status {
        type = "enum"
        values = ["active", "inactive", "pending"]
        default = "pending"
      }
  
      field created_at {
        type = "timestamp"
        default = "now()"
      }
  
      field updated_at {
        type = "timestamp"
        default = "now()"
        on_update = "now()"
      }
  
      index email_idx {
        fields = ["email"]
        type = "btree"
      }
  
      index name_idx {
        fields = ["first_name", "last_name"]
        type = "btree"
      }
    }`)
          },
          {
            annotations: {
              title: "Create Table with XanoScript",
              readOnlyHint: false,
              destructiveHint: false,
              idempotentHint: false,
              openWorldHint: true
            }
          },
          async ({ instance_name, workspace_id, type = "xs", script }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "📊 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/beta/workspace/${formatId(workspace_id)}/table`;
              const result = await makeApiRequest(url, token, "POST", { type, script }, this.env);

              return {
                content: [{ type: "text", text: `🏗️ Table Created with Script - "${result?.name || 'Unknown'}" | ID: ${result?.id || 'N/A'}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  message: "Table created successfully with XanoScript",
                  data: result,
                  operation: "xano_create_table_with_script",
                  table_info: {
                    id: result.id,
                    name: result.name,
                    field_count: result.fields ? result.fields.length : "Check table schema"
                  },
                  capabilities: [
                    "Complete table schema defined in code",
                    "All fields, types, and constraints created",
                    "Indexes automatically configured",
                    "Version-controllable database schema"
                  ],
                  field_types: [
                    "int", "decimal", "text", "email", "password",
                    "bool", "timestamp", "date", "time", "json",
                    "enum", "file", "image", "reference"
                  ],
                  next_steps: [
                    "Use xano_get_table_with_script to see the schema",
                    "Create APIs to interact with the table",
                    "Add data using table record tools"
                  ]
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: {
                      message: `Error creating table: ${error.message}`,
                      code: "EXCEPTION"
                    },
                    operation: "xano_create_table_with_script",
                    syntax_help: {
                      structure: "table name { field fieldname { type = \"type\" } index indexname { fields = [\"field\"] } }",
                      field_properties: ["type", "required", "unique", "default", "max_length", "primary_key", "auto_increment"],
                      index_types: ["btree", "hash", "search"],
                      common_mistakes: [
                        "Missing field type specification",
                        "Invalid field type",
                        "Duplicate field names",
                        "Invalid index configuration"
                      ]
                    }
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_get_table_with_script",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            table_id: z.union([z.string(), z.number()]).describe("The ID of the table"),
            type: z.enum(["xs", "yaml", "json"]).optional().default("xs").describe("Format to retrieve the schema in")
          },
          {
            annotations: {
              title: "Get Table Schema as XanoScript",
              readOnlyHint: true,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: true
            }
          },
          async ({ instance_name, workspace_id, table_id, type = "xs" }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "📊 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const params = new URLSearchParams();
              if (type) params.append("type", type);

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/beta/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}${params.toString() ? '?' + params.toString() : ''}`;
              const result = await makeApiRequest(url, token, "GET", null, this.env);

              return {
                content: [{ type: "text", text: `🏗️ Table Schema Script - "${result?.name || 'Unknown'}" | ID: ${table_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  data: result,
                  operation: "xano_get_table_with_script",
                  schema_insights: [
                    "Complete table definition in XanoScript",
                    "All fields with types and constraints",
                    "Indexes and relationships defined",
                    "Can be version controlled or shared"
                  ],
                  use_cases: [
                    "Export schema for backup",
                    "Share table structure with team",
                    "Use as template for similar tables",
                    "Track schema changes in git"
                  ]
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                "🏗️ TABLE SCHEMA": true,
                    success: false,
                    error: {
                      message: `Error getting table schema: ${error.message}`,
                      code: "EXCEPTION"
                    },
                    operation: "xano_get_table_with_script"
                  })
                }]
              };
            }
          }
        );

        this.server.tool(
          "xano_update_table_with_script",
          {
            instance_name: z.string().describe("The Xano instance domain (e.g., 'xivz-2uos-g8gq.n7.xano.io' or 'api.clearleads.io')"),
            workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
            table_id: z.union([z.string(), z.number()]).describe("The ID of the table to update"),
            type: z.enum(["xs", "yaml", "json"]).optional().default("xs").describe("Script type - always use 'xs' for XanoScript"),
            script: z.string().describe("Updated XanoScript table definition with schema changes")
          },
          {
            annotations: {
              title: "Update Table Schema with XanoScript",
              readOnlyHint: false,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: true
            }
          },
          async ({ instance_name, workspace_id, table_id, type = "xs", script }) => {
            if (!this.props?.authenticated) {
              return {
                content: [{ type: "text", text: "📊 Authentication required to use this tool." }]
              };
            }

            try {
              const token = await this.getFreshApiKey();
              if (!token) {
                throw new Error("No API key available");
              }

              const metaApi = getMetaApiUrl(instance_name);
              const url = `${metaApi}/beta/workspace/${formatId(workspace_id)}/table/${formatId(table_id)}`;
              const result = await makeApiRequest(url, token, "PUT", { type, script }, this.env);

              return {
                content: [{ type: "text", text: `✏️ Table Schema Updated - ID: ${table_id} | Workspace ${workspace_id}\n${"=".repeat(50)}\n` + JSON.stringify({
                  success: true,
                  message: "Table schema updated successfully",
                  data: result,
                  operation: "xano_update_table_with_script",
                  migration_notes: [
                    "Schema changes applied to table structure",
                    "Existing data preserved where possible",
                    "New fields added with defaults if specified",
                    "Indexes updated as defined"
                  ],
                  warnings: [
                    "Removing fields may result in data loss",
                    "Changing field types may require data conversion",
                    "Always backup before major schema changes"
                  ]
                }, null, 2) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: {
                      message: `Error updating table schema: ${error.message}`,
                      code: "EXCEPTION"
                    },
                    operation: "xano_update_table_with_script",
                    troubleshooting: [
                      "Verify table exists and has proper permissions",
                      "Check for data compatibility with schema changes",
                      "Ensure new field types are valid",
                      "Consider impact on existing APIs using this table"
                    ]
                  })
                }]
              };
            }
          }
        );

    // ===========================
    // XANOSCRIPT BUILDING GUIDANCE TOOLS
    // ===========================
    
    // 🧱 Get XanoScript function template
    this.server.tool(
      "xano_get_function_template",
      {
        function_name: z.enum(["db.query", "db.get", "db.add", "db.edit", "db.del", "var", "var.update", "api.request", "foreach", "conditional", "precondition"]).describe("XanoScript function to get template for")
      },
      async ({ function_name }) => {
        // Check if user has proper setup context
        if (!this.props?.authenticated) {
          return new SmartError(
            "Authentication required",
            "You need to authenticate before using XanoScript tools",
            {
              tip: "Start with proper setup to use XanoScript tools effectively",
              relatedTools: ["xano_list_instances", "xano_list_databases", "xano_list_tables"],
              correct: "1. xano_list_instances\n2. xano_list_databases\n3. xano_list_tables\n4. Then use XanoScript tools"
            }
          ).toMCPResponse();
        }

        try {
          const template = this.getFunctionTemplate(function_name);
          
          return {
            content: [{
              type: "text",
              text: `🧱 ${function_name} Template:\n\n${template.syntax}\n\n📝 Description: ${template.description}\n\n💡 Common Parameters:\n${template.parameters.map(p => `• ${p}`).join('\n')}\n\n⚠️ Notes:\n${template.notes.map(n => `• ${n}`).join('\n')}\n\n🚀 Setup Reminder: Make sure you have:\n• Instance name (from xano_list_instances)\n• Workspace ID (from xano_list_databases)\n• Table names (from xano_list_tables)`
            }]
          };
        } catch (error) {
          return new SmartError(
            "Template not found",
            `Template for function '${function_name}' not available`,
            {
              availableOptions: ["db.query", "db.get", "db.add", "db.edit", "db.del", "var", "var.update", "api.request", "foreach", "conditional", "precondition"]
            }
          ).toMCPResponse();
        }
      }
    );

    // 📋 Get XanoScript block template
    this.server.tool(
      "xano_get_block_template",
      {
        block_name: z.enum(["query", "function", "task", "input", "stack", "response"]).describe("XanoScript block to get template for")
      },
      async ({ block_name }) => {
        // Check if user has proper setup context
        if (!this.props?.authenticated) {
          return new SmartError(
            "Authentication required",
            "You need to authenticate before using XanoScript tools",
            {
              tip: "Start with proper setup to use XanoScript tools effectively",
              relatedTools: ["xano_list_instances", "xano_list_databases", "xano_list_tables"],
              correct: "1. xano_list_instances\n2. xano_list_databases\n3. xano_list_tables\n4. Then use XanoScript tools"
            }
          ).toMCPResponse();
        }

        try {
          const template = this.getBlockTemplate(block_name);
          
          return {
            content: [{
              type: "text",
              text: `📋 ${block_name} Block Template:\n\n${template.syntax}\n\n📝 Description: ${template.description}\n\n💡 Usage:\n${template.usage.map(u => `• ${u}`).join('\n')}\n\n✅ Example:\n${template.example}\n\n🚀 Setup Reminder: Make sure you have:\n• Instance name (from xano_list_instances)\n• Workspace ID (from xano_list_databases)\n• Table names (from xano_list_tables)`
            }]
          };
        } catch (error) {
          return new SmartError(
            "Block template not found",
            `Template for block '${block_name}' not available`,
            {
              availableOptions: ["query", "function", "task", "input", "stack", "response"]
            }
          ).toMCPResponse();
        }
      }
    );

    // 🚀 XanoScript setup guide
    this.server.tool(
      "xano_get_started",
      {},
      async () => {
        return {
          content: [{
            type: "text",
            text: `🚀 XanoScript Development Setup Guide

Before using XanoScript tools, you need proper context. Follow these steps:

📋 REQUIRED SETUP SEQUENCE:
1. 🏢 xano_list_instances - Get your Xano instances
2. 💾 xano_list_databases - Pick instance, get workspaces  
3. 📊 xano_list_tables - Pick workspace, see available tables

🧱 THEN USE XANOSCRIPT TOOLS:
• xano_get_block_template - Get API/function structure
• xano_get_function_template - Get specific function syntax
• xano_validate_line - Check syntax before proceeding

🎯 METHODOLOGY:
1. Start with block template (query/function shell)
2. Add input definitions
3. Build logic one line at a time using function templates
4. Validate each line before moving to next
5. No "throwing code at the wall" - methodical building only!

⚡ QUICK START:
Try: xano_list_instances → pick one → xano_list_databases

This approach eliminates trial-and-error XanoScript development!`
          }]
        };
      }
    );

    // 🔧 Validate single XanoScript line
    this.server.tool(
      "xano_validate_line",
      {
        line_of_script: z.string().describe("Single line or small block of XanoScript to validate"),
        context: z.string().optional().describe("Context where this line appears (e.g., 'inside stack block', 'in response')")
      },
      async ({ line_of_script, context }) => {
        try {
          const validation = this.validateSingleLine(line_of_script, context);
          
          return {
            content: [{
              type: "text",
              text: `🔧 Line Validation:\n\n${validation.valid ? '✅' : '❌'} ${validation.valid ? 'Valid' : 'Invalid'}\n\n${validation.issues.length > 0 ? '⚠️ Issues:\n' + validation.issues.map(i => `• ${i}`).join('\n') + '\n\n' : ''}${validation.suggestions.length > 0 ? '💡 Suggestions:\n' + validation.suggestions.map(s => `• ${s}`).join('\n') : ''}`
            }]
          };
        } catch (error) {
          return new SmartError(
            "Line validation failed",
            "Unable to validate XanoScript line",
            {
              tip: error.message,
              relatedTools: ["xano_get_function_template"]
            }
          ).toMCPResponse();
        }
      }
    );
  }

  // XanoScript building guidance helper methods
  private getFunctionTemplate(functionName: string) {
    const templates = {
      "db.query": {
        syntax: `db.query "table_name" {
  search = \`$db.table_name.field == "value"\`
  return_list = {
    paging: { page: 1, per_page: 25 },
    sorting: [{ sort: "field_name", order: "asc" }]
  }
} as $result`,
        description: "Query multiple records from database table",
        parameters: [
          "search: Expression with backticks for filtering",
          "return_list/return_single/return_exists/return_count: Return type",
          "paging: { page: number, per_page: number }",
          "sorting: [{ sort: 'field', order: 'asc'|'desc' }]"
        ],
        notes: [
          "Always use backticks around search expressions",
          "Access results with $result.rows[0].field for lists",
          "Use $db.table_name.field in search expressions"
        ]
      },
      "db.get": {
        syntax: `db.get "table_name" {
  field_name = "id"
  field_value = $input.id
  lock = false
} as $record`,
        description: "Get single record by field value",
        parameters: [
          "field_name: Field to search by (usually 'id')",
          "field_value: Value to match",
          "lock: true/false for row locking"
        ],
        notes: [
          "Returns single record object",
          "Access fields directly: $record.field_name",
          "Returns null if not found"
        ]
      },
      "db.add": {
        syntax: `db.add "table_name" {
  data = {
    field1: $input.value1,
    field2: "literal_value", 
    created_at: "now"
  }
} as $new_record`,
        description: "Insert new record into table",
        parameters: [
          "data: Object with field: value pairs using COLONS",
          "CRITICAL: Use colon (:) not equals (=) inside objects",
          "Variables: $input.field or quoted strings for field names"
        ],
        notes: [
          "Returns the created record with auto-generated ID",
          "Use 'now' for timestamp fields",
          "All required fields must be included"
        ]
      },
      "db.edit": {
        syntax: `db.edit "table_name" {
  field_name = "id"
  field_value = $input.id
  data = {
    field_to_update1: $input.new_value1,
    field_to_update2: "new_literal_value",
    updated_at: "now"
  }
} as $updated_record`,
        description: "Update existing record in database",
        parameters: [
          "field_name: Field to match on (usually 'id')",
          "field_value: Value to match",
          "data: Object with fields to update"
        ],
        notes: [
          "Only include fields you want to change in data object",
          "Other fields remain untouched",
          "Ensure field_name and field_value identify correct record"
        ]
      },
      "db.del": {
        syntax: `db.del "table_name" {
  field_name = "id"
  field_value = $input.id
}`,
        description: "Delete record from database",
        parameters: [
          "field_name: Field to match on (usually 'id')",
          "field_value: Value to match"
        ],
        notes: [
          "This is a permanent deletion",
          "Ensure field_name and field_value are correct",
          "No 'as' variable typically needed"
        ]
      },
      "foreach": {
        syntax: `foreach ($array_variable) {
  each as $item {
    // Process each $item
    debug.log { value = $item.field_name }
  }
}`,
        description: "Iterate over an array",
        parameters: [
          "$array_variable: Variable containing array to iterate",
          "$item: Alias for each element during iteration"
        ],
        notes: [
          "Ensure the variable is actually an array",
          "For db.query results, use $query_result.rows",
          "Creates new variable scope for $item"
        ]
      },
      "conditional": {
        syntax: `conditional {
  if (\`$variable == "value"\`) {
    // Execute if condition is true
  }
  else {
    // Execute if condition is false
  }
}`,
        description: "Execute code blocks based on condition",
        parameters: [
          "if (\`expression\`): Condition in backticks",
          "else: Optional block for false condition"
        ],
        notes: [
          "Expression must be wrapped in backticks",
          "No direct 'else if' support",
          "Use nested conditionals for complex logic"
        ]
      },
      "api.request": {
        syntax: `api.request {
  url = "https://api.example.com/endpoint"
  method = "POST"
  params = {
    key1: "value1",
    key2: $variable_value
  }
  headers = [
    "Content-Type: application/json",
    "Authorization: Bearer TOKEN"
  ]
} as $api_response`,
        description: "Make external HTTP request",
        parameters: [
          "url: Target API endpoint",
          "method: GET, POST, PUT, DELETE, etc.",
          "params: Query params (GET) or body (POST/PUT)",
          "headers: Array of 'Header-Name: Header-Value' strings"
        ],
        notes: [
          "params structure depends on method",
          "headers must be array of strings",
          "Response structure depends on external API"
        ]
      },
      "var.update": {
        syntax: `var.update $existing_variable {
  value = $new_value_or_expression
}`,
        description: "Update existing variable value",
        parameters: [
          "$existing_variable: Variable previously declared with var",
          "value: New value or expression"
        ],
        notes: [
          "Variable must be declared first with 'var'",
          "Use $ prefix for variable name",
          "Can use filters: $var|add:1"
        ]
      },
      "var": {
        syntax: `var variable_name {
  value = initial_value
}`,
        description: "Declare a new variable",
        parameters: [
          "value: Initial value for the variable",
          "Can be literal, expression, or other variable"
        ],
        notes: [
          "Use var.update to change value later",
          "Access with $variable_name",
          "Cannot redeclare same variable name"
        ]
      },
      "precondition": {
        syntax: `precondition \`$input.field != ""\` {
  error: "Field is required",
  error_type: "inputerror"
}`,
        description: "Validate condition - error if condition is TRUE",
        parameters: [
          "Expression in backticks (condition that triggers error)",
          "REAL SYNTAX: Use COLONS for error assignments",
          "Common pattern: != \"\" to check for non-empty fields"
        ],
        notes: [
          "CRITICAL: Error occurs when expression is TRUE",
          "REAL PATTERN: Use != not == for validation logic",
          "OBJECTS USE COLONS: error: \"message\" not error = \"message\"",
          "Pattern from live code examination"
        ]
      },
      "dynamic.pagination": {
        syntax: `// If variables in paging don't work, use intermediate variables:
var current_page { value = $input.page }
var items_per_page { value = $input.per_page }

db.query "table_name" {
  search = \`$db.table_name.field == "value"\`
  return_list = {
    paging: { page: $current_page, per_page: $items_per_page }
  }
} as $result`,
        description: "Dynamic pagination when variables fail in paging block",
        parameters: [
          "Create intermediate variables if direct $input.field fails",
          "Use int page { description } and int per_page { description } in input",
          "Test direct variable usage first, fallback to this pattern"
        ],
        notes: [
          "Variables SHOULD work in paging: { page: $input.page, per_page: 25 }",
          "If they don't, this is likely a Xano parsing bug",
          "Use intermediate vars as workaround",
          "Always test simple case first"
        ]
      },
      "return": {
        syntax: `return {
  value = {
    result_field: $calculated_value,
    success: true
  }
}`,
        description: "Return value from custom function (NOT response block)",
        parameters: [
          "Only used inside function blocks",
          "NOT used in query blocks (use response instead)",
          "value: Object or simple value to return"
        ],
        notes: [
          "Functions use 'return', APIs use 'response'",
          "Place at end of function stack block",
          "Cannot use both return and response in same block"
        ]
      }
    };
    
    return templates[functionName] || { 
      syntax: "Template not available", 
      description: "Unknown function", 
      parameters: [], 
      notes: [] 
    };
  }

  private getBlockTemplate(blockName: string) {
    const templates = {
      "query": {
        syntax: `query "endpoint_name" verb=POST {
  description = "Brief description of what this API does"
  
  // Define inputs, stack logic, and response here
}`,
        description: "API endpoint definition block",
        usage: [
          "Use for creating REST API endpoints",
          "verb can be GET, POST, PUT, DELETE, PATCH",
          "Always include description",
          "Tags are managed separately, not in script"
        ],
        example: `query "create_user" verb=POST {
  description = "Create a new user account"
}`
      },
      "function": {
        syntax: `function "FunctionName" {
  description = "Function description"
  
  stack {
    // Function logic (input block optional)
    return {
      value = result_object
    }
  }
}`,
        description: "Reusable custom function - called internally",
        usage: [
          "Name must be quoted (e.g., \"CalculateTotal\")",
          "Called internally from APIs, tasks, other functions",
          "Use 'return' statement, NOT response block",
          "Input block is OPTIONAL - only add if function needs parameters",
          "Cannot be called via HTTP directly"
        ],
        example: `function "CalculateOrderTotal" {
  description = "Calculates order total with tax"
  
  input {
    array items { description = "Order items array" }
    decimal tax_rate ?= 0.05 { description = "Tax rate (default 5%)" }
  }
  
  stack {
    var subtotal { value = 0 }
    foreach ($input.items) {
      each as $item {
        var item_total { value = $item.price|mul:$item.quantity }
        var.update $subtotal { value = $subtotal|add:$item_total }
      }
    }
    var tax_amount { value = $subtotal|mul:$input.tax_rate }
    var final_total { value = $subtotal|add:$tax_amount }
    
    return {
      value = {
        subtotal: $subtotal,
        tax: $tax_amount,
        total: $final_total
      }
    }
  }
}`
      },
      "task": {
        syntax: `task "TaskName" {
  description = "Task description"
  
  stack {
    // Background task logic
    // No input/response blocks needed
  }

  schedule {
    events = [
      {
        starts_on: "2025-01-01 02:00:00+0000",
        freq: 86400
      }
    ]
  }
}`,
        description: "Background scheduled task",
        usage: [
          "Name must be quoted",
          "No input/response blocks like APIs",
          "Use schedule.events array with objects",
          "freq in seconds (86400 = 1 day)"
        ],
        example: `task "NightlyDataCleanup" {
  description = "Cleanup old log entries nightly"
  
  stack {
    var cutoff_date { value = now()|add_secs_to_timestamp:(-604800) }
    
    db.bulk.delete "activity_logs" {
      search = \`$db.activity_logs.created_at < $cutoff_date\`
    } as $delete_result
    
    debug.log { value = "Cleanup completed" }
  }

  schedule {
    events = [
      {
        starts_on: "2025-01-01 02:00:00+0000",
        freq: 86400
      }
    ]
  }
}`
      },
      "input": {
        syntax: `input {
  text field_name { description = "Field description" }
  int number_field { description = "Number field" }  
  text optional_field? { description = "Optional field" }
  // WARNING: Test description syntax in your Xano
  // May be: description: "..." (with colon)
}`,
        description: "Define API input parameters",
        usage: [
          "Place immediately after query/function declaration",
          "Use ? for optional fields",
          "Field types: text, int, decimal, boolean, email, object, file",
          "SYNTAX UNCERTAIN: description = vs description:"
        ],
        example: `input {
  text name { description = "User name" }
  email email_address { description = "User email" }
  int age? { description = "User age (optional)" }
}`
      },
      "stack": {
        syntax: `stack {
  // Validation (preconditions)
  precondition \`$input.field == null\` {
    error = "Field is required"
    error_type = "inputerror"
  }
  
  // Variables
  var my_variable { value = "initial_value" }
  
  // Database operations
  db.query "table_name" {
    search = \`$db.table.field == $input.value\`
    return_list = {}
  } as $result
  
  // Logic processing
}`,
        description: "Main logic execution block",
        usage: [
          "Contains all processing logic",
          "Start with preconditions for validation",
          "Declare variables before using them",
          "Database operations go here"
        ],
        example: `stack {
  precondition \`$input.name != ""\` {
    error: "Name is required",
    error_type: "inputerror"
  }
  
  db.add "users" {
    data = { name: $input.name, created_at: "now" }
  } as $new_user
}`
      },
      "response": {
        syntax: `response {
  value = {
    success: true,
    data: $result,
    message: "Operation completed"
  }
}`,
        description: "Define API response structure",
        usage: [
          "Final block in query/function",
          "Must include 'value' field",
          "Can return objects, arrays, or simple values"
        ],
        example: `response {
  value = {
    success: true,
    user: $new_user,
    total_users: $count_result
  }
}`
      }
    };
    
    return templates[blockName] || { 
      syntax: "Template not available", 
      description: "Unknown block", 
      usage: [], 
      example: "" 
    };
  }

  private validateSingleLine(line: string, context?: string) {
    const issues: string[] = [];
    const suggestions: string[] = [];
    const trimmed = line.trim();
    
    // CRITICAL: Conservative validation - only mark things as VALID if we're sure they work
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('//')) {
      return { valid: true, issues: [], suggestions: [] };
    }
    
    // Block headers (always valid)
    if (trimmed.match(/^(query|function|task|input|stack|response)\s*\{?\s*$/)) {
      return { valid: true, issues: [], suggestions: [] };
    }
    
    // Closing braces (always valid)
    if (trimmed === '}') {
      return { valid: true, issues: [], suggestions: [] };
    }
    
    // Variable declarations (basic validation)
    if (trimmed.startsWith('var ')) {
      if (!trimmed.includes('{ value =')) {
        issues.push("Variable syntax: var name { value = ... }");
        suggestions.push("Example: var my_var { value = \"initial\" }");
      }
      return { valid: issues.length === 0, issues, suggestions };
    }
    
    // CRITICAL PRECONDITION VALIDATION - Fixed for real Xano behavior
    if (trimmed.includes('precondition')) {
      // Check if this is a complete precondition block or just the opening line
      const isOpeningLine = trimmed.startsWith('precondition') && trimmed.includes('{');
      const isErrorLine = trimmed.includes('error =') && !trimmed.includes('precondition');
      const isClosingBrace = trimmed === '}' && context && context.includes('precondition');
      
      if (isOpeningLine) {
        // Validate the precondition expression line
        if (!trimmed.includes('`')) {
          issues.push("Precondition expressions MUST be wrapped in backticks");
          suggestions.push('Example: precondition `$input.field == null` {');
        }
        
        // Check for problematic patterns
        if (trimmed.includes('!= ""')) {
          issues.push('WARNING: Empty string comparisons (!= "") may not work reliably in Xano');
          suggestions.push('Use == null for required field validation instead');
        }
        
        if (trimmed.includes('len(') || trimmed.includes('length(')) {
          issues.push('Use |strlen filter instead of len() function');
          suggestions.push('Example: `($input.field|strlen) == 0`');
        }
        
        // Opening line should have backticks and opening brace
        if (!trimmed.includes('{')) {
          issues.push("Precondition line should end with opening brace {");
        }
      } else if (isErrorLine) {
        // Error assignment lines should be valid
        if (!trimmed.includes('"') && trimmed.includes('error =')) {
          issues.push('Error message should be in quotes');
          suggestions.push('Example: error = "Field is required"');
        }
      } else if (isClosingBrace) {
        // Closing braces are always valid
        return { valid: true, issues: [], suggestions: [] };
      }
      
      return { valid: issues.length === 0, issues, suggestions };
    }
    
    // Error assignment lines - REAL SYNTAX with colons
    if (trimmed.startsWith('error:') && trimmed.includes('"')) {
      return { valid: true, issues: [], suggestions: [] };
    }
    
    // Error type assignment lines - REAL SYNTAX with colons
    if (trimmed.startsWith('error_type:') && trimmed.includes('"')) {
      return { valid: true, issues: [], suggestions: [] };
    }
    
    // WRONG syntax - equals assignment in objects
    if ((trimmed.startsWith('error =') || trimmed.startsWith('error_type =')) && trimmed.includes('"')) {
      issues.push("WRONG SYNTAX: Use colons in objects, not equals");
      suggestions.push("Change 'error = \"message\"' to 'error: \"message\"'");
      suggestions.push("Objects use colons: { key: value } not { key = value }");
      return { valid: false, issues, suggestions };
    }
    
    // Simple object property assignments (key: value)
    if (trimmed.match(/^\s*\w+:\s*[$"\w]/) && !trimmed.includes('=')) {
      return { valid: true, issues: [], suggestions: [] };
    }
    
    // Database operations
    if (trimmed.includes('db.')) {
      if (!trimmed.includes('"') && (trimmed.includes('db.query') || trimmed.includes('db.get') || trimmed.includes('db.add') || trimmed.includes('db.edit') || trimmed.includes('db.del'))) {
        issues.push("Table name should be in quotes");
        suggestions.push('Example: db.query "table_name" {');
      }
      
      if (trimmed.includes('search =') && !trimmed.includes('`')) {
        issues.push("Search expressions must be wrapped in backticks");
        suggestions.push('Example: search = `$db.table.field == "value"`');
      }
      
      return { valid: issues.length === 0, issues, suggestions };
    }
    
    // API vs Function/Task reliability guidance
    if (trimmed.includes('response {') || (context && context.includes('response') && trimmed.includes('$'))) {
      if (context && context.includes('query')) {
        suggestions.push("✅ APIs work reliably - this should generate correctly");
        suggestions.push("Use xano_get_api_with_logic to verify syntax if needed");
      } else if (context && (context.includes('function') || context.includes('task'))) {
        suggestions.push("⚠️ Functions/Tasks may have variable quoting issues");
        suggestions.push("Structure works but variables may become \"strings\" instead of $variables");
        suggestions.push("Always verify with get_function_details or get_task_details after creation");
      }
    }
    
    // Dynamic pagination warning
    if (trimmed.includes('paging:') && trimmed.includes('$input.')) {
      suggestions.push("PAGINATION NOTE: If variables fail in paging block, use intermediate vars as workaround");
      suggestions.push("Example: var page_num { value = $input.page } then use $page_num");
    }
    
    // For anything else, be conservative - mark as potentially invalid
    if (trimmed.includes('=') || trimmed.includes(':') || trimmed.includes('{')) {
      // Complex syntax - cannot reliably validate without full Xano parser
      suggestions.push("Complex syntax detected - test in Xano to verify");
      suggestions.push("Use templates from xano_get_function_template for proven patterns");
    }
    
    return {
      valid: issues.length === 0,
      issues,
      suggestions
    };
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
// Commented out as we're not using queue logging yet
// export async function queue(batch: MessageBatch, env: Env): Promise<void> {
//   const { default: queueConsumer } = await import('./queue-consumer');
//   await queueConsumer.queue(batch, env);
// }

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