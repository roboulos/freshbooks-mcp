# Xano MCP Server with Simple Authentication

A minimal implementation of a Cloudflare Workers-based MCP (Model Context Protocol) server that authenticates with Xano. This server enables AI assistants like Claude to securely interact with your Xano backend using token-based authentication.

## ✅ VERIFIED WORKING SOLUTION - SIMPLE TOKEN VALIDATION

This implementation has been verified to work correctly with:
- Cloudflare AI Playground
- Cloudflare Workers and Durable Objects
- Xano authentication
- Claude AI assistant

## Implementation Details & Limitations

This is the **simple token validation** implementation with the following characteristics:

### What This Implementation Does
- Validates Xano tokens on each request
- Uses a simple authentication approach without session persistence
- Implements a basic Durable Object for MCP functionality
- Provides a clean, minimal codebase that's easy to understand and extend

### Limitations & Considerations
- **No Session Persistence**: Authentication state is not preserved across Durable Object hibernation
- **No Token Storage**: Tokens must be provided with each request
- **No Refresh Logic**: No built-in token refresh or expiration handling
- **Re-Authentication Required**: If the Durable Object hibernates, users must re-authenticate
- **Minimal Error Handling**: Basic error reporting without detailed user feedback

### When to Use This Implementation
- For development and testing with Xano
- For projects where authentication simplicity is preferred over robustness
- For scenarios where re-authentication is acceptable
- When you need a minimal implementation to build upon

## Branch Information

For a more advanced implementation with persistent authentication state using OAuthProvider, check out the `oauth-provider-experiment` branch:
```bash
git checkout oauth-provider-experiment
```

## Features

- **Minimalist MCP Server**: Clean, simple implementation with no dependencies beyond the core SDK
- **Basic Xano Authentication**: Validates access tokens against Xano's API on each request
- **Multiple Connection Methods**: Supports both SSE (browser) and streamable HTTP connections
- **Type Safety**: Full TypeScript support for better developer experience
- **Easy to Extend**: Add your own tools to interact with Xano's API

## Prerequisites

- A Cloudflare account with Workers access
- A Xano instance with authentication API endpoint
- npm and wrangler CLI installed

## Quick Start

1. Clone this repository:
   ```
   git clone https://github.com/roboulos/cloudflare-mcp-server.git
   cd cloudflare-mcp-server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Update your Xano URL in `wrangler.jsonc`:
   ```json
   "vars": {
     "XANO_BASE_URL": "https://YOUR-INSTANCE.n7c.xano.io"
   }
   ```

4. Deploy to Cloudflare:
   ```
   npx wrangler deploy
   ```

5. Connect via Cloudflare AI Playground:
   ```
   https://your-worker.your-account.workers.dev/sse?auth_token=YOUR_XANO_TOKEN
   ```

## How It Works

### Authentication Flow

1. Client connects with a Xano token via URL parameter (`?auth_token=...`) or Authorization header (`Bearer ...`)
2. Server validates the token with Xano's API on every request
3. If valid, creates a simple authentication context (`{ user: { id: 'xano_user', authenticated: true } }`)
4. Tools check `this.props?.user?.authenticated` before executing
5. If the Durable Object hibernates, the authentication state is lost and re-authentication is required

### Key Files

- `src/index.ts`: The main MCP server implementation
- `wrangler.jsonc`: Cloudflare Worker configuration

## Technical Implementation

The implementation uses a single file approach with three main components:

1. **Token Extraction & Validation**
   - Simple token extraction from URL parameters or Authorization header
   - Basic validation against Xano's API

2. **MCP Agent Class (Durable Object)**
   - Minimal MCP implementation with authentication checks
   - No state persistence for authentication

3. **Request Handler**
   - Routes requests to the appropriate MCP endpoints
   - Creates a new authentication context on each request

## Code Explanation

### Authentication Context

```typescript
interface AuthContext {
  user?: {
    id: string;
    authenticated: boolean;
  };
}
```

### Token Extraction

```typescript
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
```

### MCP Agent with Tool

```typescript
export class MyMCP extends McpAgent<Env, unknown, AuthContext> {
  server = new McpServer({
    name: "Xano MCP Server",
    version: "1.0.0",
  });
  
  async init() {
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
```

### Request Handler with Token Validation

```typescript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Extract and validate token
    const token = extractToken(request);
    let authContext = {};
    
    if (token) {
      try {
        const response = await fetch(`${env.XANO_BASE_URL}/api:e6emygx3/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
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
    
    // Serve the appropriate endpoint with auth context
    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return MyMCP.serveSSE("/sse", authContext).fetch(request, env, ctx);
    }
    
    if (url.pathname === "/mcp") {
      return MyMCP.serve("/mcp", authContext).fetch(request, env, ctx);
    }
    
    return new Response("Not found", { status: 404 });
  },
};
```

## Adding Your Own Tools

To add new tools that interact with Xano:

1. Add new tool registrations in the `init()` method
2. Use `this.props?.user?.authenticated` to check authentication
3. Make API calls to your Xano backend using fetch

## Troubleshooting

- **"Session not found" error**: This may occur after hibernation. Re-authenticate by providing the token again.
- **Authentication failures**: Verify your Xano token and API endpoint
- **Deployment issues**: Check your wrangler.jsonc configuration
- **Authentication lost after inactivity**: This is expected behavior with this implementation. Use the oauth-provider-experiment branch for persistent sessions.

## Resources

- [Model Context Protocol (MCP) Documentation](https://github.com/anthropics/model-context-protocol)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Xano Documentation](https://docs.xano.com/)

## License

MIT