import { Hono } from "hono";
import { OAuthProvider } from "@cloudflare/oauth";
import { MyMCP, AuthProps } from "./my-mcp";
import { XanoAuthHandler } from "./auth-handler";
import { extractToken } from "./utils";

export interface Env {
  MCP_OBJECT: DurableObjectNamespace;
  OAUTH_KV: KVNamespace;
  XANO_BASE_URL: string;
  OAUTH_PROVIDER?: any;
}

// Main Hono app
const app = new Hono<{ Bindings: Env }>();

// Create and configure OAuth provider
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Set up OAuth provider
    const oauthProvider = new OAuthProvider<AuthProps>({
      kvNamespace: env.OAUTH_KV,
      oauth: {
        clientId: "xano-mcp-server",
        authorizationUrl: new URL("/authorize", new URL(request.url).origin).toString(),
        tokenUrl: new URL("/token", new URL(request.url).origin).toString(),
      },
    });
    env.OAUTH_PROVIDER = oauthProvider;

    // Route auth-related endpoints
    app.route("/", XanoAuthHandler);

    // For backward compatibility, check if there's a token in the request
    // If there is and we're not authenticated yet, go through the auth flow
    const token = extractToken(request);
    let authProps = await oauthProvider.getAuthProps(request);
    
    if (token && !authProps) {
      // If we have a token but no auth props, try to authenticate with Xano
      try {
        const response = await fetch(`${env.XANO_BASE_URL}/api:e6emygx3/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          // Parse the Xano auth response to get the user data
          const userData = await response.json();
          
          // Complete authorization with the OAuth provider
          if (userData && userData.api_key) {
            // Redirect to authorization endpoint with the token
            const authUrl = new URL("/authorize", new URL(request.url).origin);
            authUrl.searchParams.set("auth_token", token);
            
            // Add OAuth required params
            authUrl.searchParams.set("client_id", "xano-mcp-server");
            authUrl.searchParams.set("redirect_uri", url.toString());
            authUrl.searchParams.set("response_type", "code");
            authUrl.searchParams.set("state", crypto.randomUUID());
            
            return Response.redirect(authUrl.toString(), 302);
          }
        }
      } catch (error) {
        console.error('Error validating token:', error);
      }
    }

    // Handle MCP agent requests
    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      // Get most recent auth props
      authProps = await oauthProvider.getAuthProps(request);
      
      // Create auth context
      let authContext = {};
      
      if (authProps) {
        // Format auth props to be compatible with both formats
        authContext = {
          // Direct properties for new code
          apiKey: authProps.apiKey,
          authenticated: true,
          userId: authProps.userId || 'xano_user',
          
          // Nested user object for backward compatibility
          user: {
            id: authProps.userId || 'xano_user',
            authenticated: true,
            apiKey: authProps.apiKey
          }
        };
      }
      
      return MyMCP.serveSSE("/sse", authContext).fetch(request, env, ctx);
    }
    
    if (url.pathname === "/mcp") {
      // Get most recent auth props
      authProps = await oauthProvider.getAuthProps(request);
      
      // Create auth context
      let authContext = {};
      
      if (authProps) {
        // Format auth props to be compatible with both formats
        authContext = {
          // Direct properties for new code
          apiKey: authProps.apiKey,
          authenticated: true,
          userId: authProps.userId || 'xano_user',
          
          // Nested user object for backward compatibility
          user: {
            id: authProps.userId || 'xano_user',
            authenticated: true,
            apiKey: authProps.apiKey
          }
        };
      }
      
      return MyMCP.serve("/mcp", authContext).fetch(request, env, ctx);
    }
    
    // Handle other routes with the Hono app
    return app.fetch(request, env, ctx);
  },
};

// Export Durable Object class
export { MyMCP };