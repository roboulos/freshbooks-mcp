# Xano MCP Server with Persistent Authentication

A Cloudflare Workers-based MCP (Model Context Protocol) server that authenticates with Xano and maintains persistent authentication state across Durable Object hibernation using OAuthProvider. This server enables AI assistants like Claude to securely interact with your Xano backend even after periods of inactivity.

## ⚠️ EXPERIMENTAL SOLUTION - OAUTH PROVIDER WITH PERSISTENCE

This implementation is experimental and uses Cloudflare's OAuthProvider for persistent authentication.

## Branch Information

This repository is organized into three branches for different use cases:

1. **`main`**: Minimal implementation with basic authentication
2. **`xano-tools`**: Adds Xano API tools while keeping the simple authentication
3. **`oauth-provider`** (current): Uses OAuthProvider for persistent authentication

```bash
# For minimal implementation (stable)
git checkout main

# For implementation with Xano tools
git checkout xano-tools

# For implementation with persistent OAuth (current branch)
git checkout oauth-provider
```

## Implementation Details

This is the **persistent authentication with OAuthProvider** implementation:

### What This Implementation Does
- Uses Cloudflare's OAuthProvider for persistent authentication
- Maintains authentication state across Durable Object hibernation
- Stores authentication tokens in KV storage
- Automatic token validation and restoration on reconnection
- Provides a more robust authentication flow for production use

### Advantages Over Other Branches
- **Persistent Authentication**: Authentication state persists even after Durable Object hibernation
- **Token Storage**: Tokens are securely stored in KV storage
- **Resilient Connections**: Users don't need to re-authenticate after periods of inactivity
- **Enhanced Security**: Better token management and security practices
- **Automated Handling**: Less client-side authentication management required

### When to Use This Implementation
- For production applications requiring persistent authentication
- For scenarios where users should remain authenticated across sessions
- When authentication tokens need to be securely managed
- When a more robust authentication flow is required

## Features

- **Persistent Authentication**: Authentication state persists across Durable Object hibernation
- **OAuthProvider Integration**: Leverages Cloudflare's OAuthProvider for state management
- **KV Storage**: Uses Cloudflare KV for token storage
- **Multiple Connection Methods**: Supports both SSE (browser) and streamable HTTP connections
- **Type Safety**: Full TypeScript support for better developer experience

## Prerequisites

- A Cloudflare account with Workers access and KV storage
- A Xano instance with authentication API endpoint
- npm and wrangler CLI installed

## Quick Start

1. Clone this repository:
   ```
   git clone https://github.com/roboulos/cloudflare-mcp-server.git
   cd cloudflare-mcp-server
   ```

2. Switch to the oauth-provider branch:
   ```
   git checkout oauth-provider
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Create a KV namespace for token storage:
   ```
   npx wrangler kv:namespace create OAUTH_KV
   ```

5. Update your wrangler.toml with the KV namespace ID from the previous step:
   ```toml
   [[kv_namespaces]]
   binding = "OAUTH_KV" 
   id = "YOUR_KV_NAMESPACE_ID"
   ```

6. Update your Xano URL in wrangler.toml:
   ```toml
   [vars]
   XANO_BASE_URL = "https://YOUR-INSTANCE.n7c.xano.io"
   ```

7. Deploy to Cloudflare:
   ```
   npx wrangler deploy
   ```

8. Connect via Cloudflare AI Playground (you'll only need to authenticate once):
   ```
   https://your-worker.your-account.workers.dev/sse?auth_token=YOUR_XANO_TOKEN
   ```

## How It Works

### Authentication Flow

1. Client connects with a Xano token via URL parameter (`?auth_token=...`) or Authorization header (`Bearer ...`)
2. The server validates the token with Xano's API and generates an OAuth token
3. The OAuth token is stored in KV storage and associated with the session
4. On reconnection, the OAuth token is retrieved from KV storage automatically
5. Even after Durable Object hibernation, the session remains authenticated

### Key Files

- `src/index.ts`: Main entry point with OAuthProvider setup
- `src/auth-handler.ts`: Authentication handler for token management
- `src/my-mcp.ts`: MCP agent implementation with tools
- `src/utils.ts`: Utility functions for API requests
- `wrangler.toml`: Cloudflare Worker configuration with KV bindings

## Technical Implementation

The implementation uses a modular approach with four main components:

1. **OAuthProvider**
   - Manages token persistence through KV storage
   - Handles token generation, validation, and retrieval

2. **Authentication Handler**
   - Processes initial authentication with Xano
   - Converts Xano tokens to OAuth tokens for persistence

3. **MCP Agent**
   - Implements tools with authentication checks
   - Uses stored authentication data for operations

4. **Request Handler**
   - Routes requests to appropriate endpoints
   - Manages authentication flow

## Adding Your Own Tools

To add new tools with persistent authentication:

1. Add new tool registrations in the `init()` method of `my-mcp.ts`
2. Use `this.props?.authenticated` or `this.props?.user?.authenticated` to check authentication
3. Use the stored API key for making calls to Xano

## Troubleshooting

- **First-time setup**: On first connection, you need to provide a token via URL or header
- **KV namespace issues**: Ensure your KV namespace is correctly configured in wrangler.toml
- **Deployment issues**: Check your wrangler.toml configuration
- **Authentication errors**: Ensure your Xano token is valid

## Resources

- [Model Context Protocol (MCP) Documentation](https://github.com/anthropics/model-context-protocol)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare OAuth Provider](https://developers.cloudflare.com/workers/runtime-apis/oauth/)
- [Xano Documentation](https://docs.xano.com/)

## License

MIT