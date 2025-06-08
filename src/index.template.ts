import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, fetchXanoUserInfo } from "./utils";
import { SmartError } from "./smart-error";

// Props passed from OAuth - contains user authentication data
interface XanoAuthProps {
  accessToken: string;
  name: string;
  email: string;
  apiKey: string | null;
  userId: string;
  authenticated: boolean;
}

// Environment bindings from wrangler.jsonc
export interface Env {
  MCP_OBJECT: DurableObjectNamespace;
  OAUTH_KV: KVNamespace;
  SESSION_CACHE: KVNamespace;
  XANO_BASE_URL: string;
  COOKIE_ENCRYPTION_KEY: string;
  OAUTH_TOKEN_TTL?: string;
}

// Clean up expired auth tokens
async function deleteAllAuthTokens(env: Env): Promise<number> {
  let deletedCount = 0;
  
  const tokenEntries = await env.OAUTH_KV.list({ prefix: 'token:' });
  for (const key of tokenEntries.keys || []) {
    await env.OAUTH_KV.delete(key.name);
    deletedCount++;
  }
  
  const xanoAuthEntries = await env.OAUTH_KV.list({ prefix: 'xano_auth_token:' });
  for (const key of xanoAuthEntries.keys || []) {
    await env.OAUTH_KV.delete(key.name);
    deletedCount++;
  }
  
  return deletedCount;
}

export class MyMCP extends McpAgent<Env, unknown, XanoAuthProps> {
  server = new McpServer({
    name: "Example MCP Server",
    version: "1.0.0",
  });

  async getFreshApiKey(): Promise<string | null> {
    // This method returns the API key from OAuth props
    // The key is set during authentication in xano-handler.ts
    console.log("getFreshApiKey called with props:", {
      userId: this.props?.userId,
      email: this.props?.email,
      hasApiKey: !!this.props?.apiKey,
      apiKeyPrefix: this.props?.apiKey ? this.props.apiKey.substring(0, 20) + "..." : null
    });
    return this.props?.apiKey || null;
  }

  // Helper method to make authenticated API requests
  async makeAuthenticatedRequest(url: string, method = "GET", data?: any): Promise<any> {
    const token = await this.getFreshApiKey();
    if (!token) {
      throw new Error("No API key available");
    }
    // Pass userId for proper user-scoped token refresh
    return makeApiRequest(url, token, method, data, this.env, this.props?.userId);
  }

  async init() {
    
    // ===== EXAMPLE 1: Simple Tool with Authentication Check =====
    this.server.tool(
      "example_hello",
      {
        // Zod schema defines the parameters
        name: z.string().describe("Name to greet"),
        excited: z.boolean().optional().describe("Whether to add excitement")
      },
      async ({ name, excited }) => {
        // Always check authentication first
        if (!this.props?.authenticated) {
          return {
            content: [{ type: "text", text: "🔒 Authentication required. Please log in first." }]
          };
        }

        const greeting = excited ? `Hello, ${name}! 🎉` : `Hello, ${name}.`;
        
        return {
          content: [{
            type: "text",
            text: `${greeting}\n\nYou are authenticated as: ${this.props.email}`
          }]
        };
      }
    );

    // ===== EXAMPLE 2: Tool Making External API Calls =====
    this.server.tool(
      "example_fetch_data",
      {
        endpoint: z.string().describe("API endpoint to fetch from"),
        method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
        data: z.any().optional().describe("Data to send with POST/PUT requests")
      },
      async ({ endpoint, method, data }) => {
        // Check authentication
        if (!this.props?.authenticated) {
          return SmartError.authenticationFailed().toMCPResponse();
        }

        try {
          // Use the helper method for authenticated requests
          const result = await this.makeAuthenticatedRequest(
            endpoint,
            method,
            data
          );

          return {
            content: [{
              type: "text",
              text: `✅ API Response:\n${JSON.stringify(result, null, 2)}`
            }]
          };
        } catch (error) {
          // Use SmartError for consistent error handling
          return new SmartError(
            "API request failed",
            error.message,
            {
              tip: "Check that the endpoint is correct and you have permission to access it",
              endpoint,
              method
            }
          ).toMCPResponse();
        }
      }
    );

    // ===== EXAMPLE 3: Tool with Complex Input Validation =====
    this.server.tool(
      "example_create_record",
      {
        table_name: z.string().min(1).describe("Name of the table"),
        fields: z.record(z.any()).describe("Field values as key-value pairs"),
        validate_required: z.array(z.string()).optional().describe("List of required field names")
      },
      async ({ table_name, fields, validate_required }) => {
        if (!this.props?.authenticated) {
          return SmartError.authenticationFailed().toMCPResponse();
        }

        // Example validation logic
        if (validate_required) {
          const missingFields = validate_required.filter(field => !fields[field]);
          if (missingFields.length > 0) {
            return new SmartError(
              "Missing required fields",
              `The following fields are required: ${missingFields.join(", ")}`,
              {
                tip: "Add the missing fields to your request",
                missingFields,
                providedFields: Object.keys(fields)
              }
            ).toMCPResponse();
          }
        }

        // Simulate creating a record
        const mockResponse = {
          id: Math.floor(Math.random() * 10000),
          table: table_name,
          fields: fields,
          created_at: new Date().toISOString()
        };

        return {
          content: [{
            type: "text",
            text: `📝 Record Created Successfully\n${JSON.stringify(mockResponse, null, 2)}`
          }]
        };
      }
    );

    // ===== EXAMPLE 4: Tool with Progress Updates (for long operations) =====
    this.server.tool(
      "example_batch_operation",
      {
        items: z.array(z.string()).describe("List of items to process"),
        delay_ms: z.number().default(100).describe("Delay between items (ms)")
      },
      async ({ items, delay_ms }) => {
        if (!this.props?.authenticated) {
          return SmartError.authenticationFailed().toMCPResponse();
        }

        const results = [];
        const errors = [];

        // Process items one by one
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          
          try {
            // Simulate processing with delay
            await new Promise(resolve => setTimeout(resolve, delay_ms));
            
            // Simulate random success/failure
            if (Math.random() > 0.8) {
              throw new Error(`Failed to process ${item}`);
            }
            
            results.push({
              item,
              status: "success",
              processedAt: new Date().toISOString()
            });
          } catch (error) {
            errors.push({
              item,
              status: "error",
              error: error.message
            });
          }
        }

        // Return detailed results
        return {
          content: [{
            type: "text",
            text: `📊 Batch Operation Complete
            
Total Items: ${items.length}
Successful: ${results.length}
Failed: ${errors.length}

Results:
${JSON.stringify({ results, errors }, null, 2)}`
          }]
        };
      }
    );

    // ===== EXAMPLE 5: Debug/Admin Tools =====
    this.server.tool(
      "debug_auth_status",
      {},
      async () => {
        // This tool doesn't require authentication - useful for debugging
        const authInfo = {
          authenticated: this.props?.authenticated || false,
          userId: this.props?.userId || "none",
          email: this.props?.email || "none",
          hasApiKey: !!this.props?.apiKey,
          timestamp: new Date().toISOString()
        };

        return {
          content: [{
            type: "text",
            text: `🔍 Authentication Status\n${JSON.stringify(authInfo, null, 2)}`
          }]
        };
      }
    );

    // ===== EXAMPLE 6: Tool that Returns Different Content Types =====
    this.server.tool(
      "example_multi_content",
      {
        content_type: z.enum(["text", "json", "markdown", "error"]).describe("Type of content to return")
      },
      async ({ content_type }) => {
        if (!this.props?.authenticated) {
          return SmartError.authenticationFailed().toMCPResponse();
        }

        switch (content_type) {
          case "text":
            return {
              content: [{
                type: "text",
                text: "This is plain text content."
              }]
            };
            
          case "json":
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  message: "This is JSON content",
                  timestamp: new Date().toISOString(),
                  user: this.props.email
                }, null, 2)
              }]
            };
            
          case "markdown":
            return {
              content: [{
                type: "text",
                text: `# Markdown Content
                
This is **bold** and this is *italic*.

## Lists
- Item 1
- Item 2
- Item 3

## Code
\`\`\`javascript
console.log("Hello from MCP!");
\`\`\`
`
              }]
            };
            
          case "error":
            throw new Error("This is an intentional error for demonstration");
            
          default:
            return {
              content: [{
                type: "text",
                text: "Unknown content type"
              }]
            };
        }
      }
    );

    // ===== ADMIN TOOL: Clear Auth Tokens (with confirmation) =====
    this.server.tool(
      "admin_clear_all_tokens",
      {
        confirm: z.boolean().describe("Set to true to confirm token deletion")
      },
      async ({ confirm }) => {
        // Admin tools might have additional checks
        if (!this.props?.authenticated || this.props.email !== "admin@example.com") {
          return new SmartError(
            "Unauthorized",
            "This tool requires admin privileges",
            { tip: "Contact your administrator for access" }
          ).toMCPResponse();
        }

        if (!confirm) {
          return {
            content: [{
              type: "text",
              text: "⚠️ This will delete all authentication tokens. Set confirm=true to proceed."
            }]
          };
        }

        try {
          const deletedCount = await deleteAllAuthTokens(this.env);
          
          return {
            content: [{
              type: "text",
              text: `🗑️ Deleted ${deletedCount} authentication tokens.\n\nAll users will need to re-authenticate.`
            }]
          };
        } catch (error) {
          return new SmartError(
            "Failed to clear tokens",
            error.message
          ).toMCPResponse();
        }
      }
    );
  }
}

// Export required handlers for Cloudflare Workers
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { default: xanoHandler } = await import('./xano-handler');
    return xanoHandler.fetch(request, env);
  }
};

// Durable Object export
export { MyMCP };