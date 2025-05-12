import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define an interface for authentication context
interface AuthContext {
  user?: {
    id: string;
    authenticated: boolean;
    // Add any other user properties you need
  };
}

// Helper function to extract token
function extractToken(request) {
  // Check URL parameters
  const url = new URL(request.url);
  const urlToken = url.searchParams.get('auth_token');
  if (urlToken) return urlToken;
  
  // Check Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

export class MyMCP extends McpAgent<Env, unknown, AuthContext> {
  server = new McpServer({
    name: "Xano MCP Server",
    version: "1.0.0",
  });
  
  async init() {
    // Register your hello tool
    this.server.tool(
      "hello",
      { name: z.string() },
      async ({ name }) => {
        // Check authentication
        if (!this.props?.user?.authenticated) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }
        
        return {
          content: [{ type: "text", text: `Hello, ${name}! You are authenticated as ${this.props.user.id}.` }]
        };
      }
    );
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Extract token from request
    const token = extractToken(request);
    
    // Create auth context
    let authContext = {};
    
    // Verify token with Xano if present
    if (token) {
      try {
        const response = await fetch(`${env.XANO_BASE_URL}/api:e6emygx3/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          // Token is valid, create auth context
          authContext = {
            user: {
              id: 'xano_user',
              authenticated: true
            }
          };
        }
      } catch (error) {
        console.error('Error validating token:', error);
      }
    }
    
    // Pass auth context to MCP server
    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return MyMCP.serveSSE("/sse", authContext).fetch(request, env, ctx);
    }
    
    if (url.pathname === "/mcp") {
      return MyMCP.serve("/mcp", authContext).fetch(request, env, ctx);
    }
    
    return new Response("Not found", { status: 404 });
  },
};

// For TypeScript
interface Env {
  MCP_OBJECT: DurableObjectNamespace;
  XANO_BASE_URL: string;
}