# Xano MCP Server with Authentication

A working implementation of a Cloudflare Workers-based MCP (Model Context Protocol) server that authenticates with Xano. This server enables AI assistants like Claude to securely interact with your Xano backend.

## ✅ VERIFIED WORKING SOLUTION

This implementation has been verified to work correctly with:
- Cloudflare AI Playground
- Cloudflare Workers
- Xano authentication
- Claude AI assistant

## Branch Structure

This repository uses the following branch organization:

- **`main`**: Contains the stable, verified working implementation
- **`oauth-provider-experiment`**: Experimental implementation using Cloudflare's OAuthProvider for better state persistence

To switch between versions:
```bash
# For the stable version
git checkout main

# For the experimental OAuth version
git checkout oauth-provider-experiment
```

## Features

- **Simple MCP Server**: Minimal, clean implementation based on the official authless example
- **Xano Authentication**: Validates access tokens against Xano's API
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

1. Client connects with a Xano token via URL parameter or Authorization header
2. Server validates the token with Xano's API
3. If valid, creates an authentication context that tools can access
4. Tools verify authentication before executing

### Key Files

- `src/index.ts`: The main MCP server implementation
- `wrangler.jsonc`: Cloudflare Worker configuration

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

- **"Session not found" error**: Make sure you're connecting with a valid session ID
- **Authentication failures**: Verify your Xano token and API endpoint
- **Deployment issues**: Check your wrangler.jsonc configuration

## Resources

- [Model Context Protocol (MCP) Documentation](https://github.com/anthropics/model-context-protocol)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Xano Documentation](https://docs.xano.com/)

## License

MIT