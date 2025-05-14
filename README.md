# Xano MCP Server with Basic Token Authentication

A minimal implementation of a Cloudflare Workers-based MCP (Model Context Protocol) server that passes through Xano authentication tokens. This server enables AI assistants like Claude to interact with your Xano backend using simple token-based authentication.

## ✅ BASIC TOKEN PASSTHROUGH - SIMPLEST APPROACH

This implementation provides the most straightforward approach to connecting Claude with Xano:
- Passes the auth_token from URL parameters to Xano
- Validates tokens against Xano's API
- Shows MCP tools when a valid token is provided
- No session state or persistence

## Implementation Details & Limitations

This is the **basic token passthrough** implementation with the following characteristics:

### What This Implementation Does
- Extracts auth_token from URL parameters or Authorization headers
- Validates tokens against Xano's API endpoint (auth/me)
- Provides a simple authentication context for tools
- Shows MCP tools when authenticated
- Implements minimal code with no complex OAuth flows

### Limitations & Considerations
- **No Session Persistence**: Authentication is validated on each request
- **No Tool State**: Each hibernation resets any tool context or state
- **Simple Validation**: Only checks if token is valid, with minimal error handling
- **Reconnection Issues**: Tools disappear when the Durable Object hibernates
- **No OAuth Flow**: No login UI, token must be provided manually

### When to Use This Implementation
- For quick testing or proof-of-concept with Xano
- When you want the simplest possible implementation
- For learning how basic MCP authentication works
- When persistent authentication isn't required

## Branch Information

This repository is organized into branches with increasing functionality:

1. **`main`** (current): The simplest implementation - basic token validation
2. **`xano-tools`**: Adds Xano API tools but lacks persistence (tools disappear on hibernation)
3. **`oauth-provider`**: Full OAuth implementation with persistent session state

```bash
# For implementations with more features:
git checkout xano-tools     # For Xano API tools (but no persistence)
git checkout oauth-provider # For persistent OAuth authentication (recommended)
```

## Features

- **Minimalist MCP Server**: Clean, simple implementation with no dependencies beyond the core SDK
- **Basic Xano Authentication**: Passes and validates access tokens against Xano's API
- **Multiple Connection Methods**: Supports both SSE (browser) and HTTP connections
- **Type Safety**: Full TypeScript support for better developer experience
- **Easy to Understand**: Simple codebase that's perfect for learning how MCP works

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

3. Update your Xano URL in `wrangler.toml`:
   ```toml
   [vars]
   XANO_BASE_URL = "https://YOUR-INSTANCE.n7c.xano.io"
   ```

4. Deploy to Cloudflare:
   ```
   npx wrangler deploy
   ```

5. Connect using Claude or the Cloudflare AI Playground:
   ```
   https://your-worker.your-account.workers.dev/sse?auth_token=YOUR_XANO_TOKEN
   ```

## How It Works

### Authentication Flow

1. Client connects with a Xano token via URL parameter (`?auth_token=...`) or Authorization header
2. Server validates the token with Xano's `/auth/me` API endpoint
3. If valid, creates a simple authentication context for the MCP agent
4. Tools check for authentication before executing
5. No session state is maintained - token is validated on each request

### Key Files

- `src/index.ts`: The main MCP server implementation with token extraction and validation
- `wrangler.toml`: Cloudflare Worker configuration

## Technical Implementation

The implementation uses a single file approach with three main components:

1. **Token Extraction**
   - Extracts tokens from URL parameters or Authorization headers
   - No token storage or management

2. **Xano Validation**
   - Simple validation against Xano's `/auth/me` endpoint
   - Creates a basic authentication context object

3. **MCP Agent**
   - Sets up a basic MCP agent with authentication checks
   - Minimal implementation with no persistence

## Adding Your Own Tools

To add new tools:

1. Add tool registrations in the `init()` method of the MCP agent class
2. Use `this.props?.user?.authenticated` to check authentication
3. Make direct API calls to Xano as needed

## Troubleshooting

- **Tools disappear after inactivity**: This is expected - this implementation has no persistence
- **Authentication failures**: Verify your Xano token is valid
- **"Authentication required" messages**: Make sure your token is being passed correctly

## Moving to More Advanced Implementations

When you outgrow this implementation:

1. **Need Xano tools?** Use the `xano-tools` branch for basic Xano API operations
2. **Need persistence?** Use the `oauth-provider` branch for full OAuth flow with session persistence

The **oauth-provider** branch solves the hibernation issue where tools disappear, by implementing a proper OAuth flow that maintains authentication state.

## Resources

- [Model Context Protocol (MCP) Documentation](https://github.com/anthropics/model-context-protocol)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Xano Documentation](https://docs.xano.com/)

## License

MIT