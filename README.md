# Xano MCP Server with Persistent Authentication

A Cloudflare Workers-based MCP (Model Context Protocol) server that authenticates with Xano and maintains persistent authentication state across Durable Object hibernation using OAuthProvider. This server enables AI assistants like Claude to securely interact with your Xano backend even after periods of inactivity.

## Branch Information

This repository is organized into three branches for different use cases:

1. **`main`**: Minimal implementation with basic token validation
2. **`xano-tools`**: Adds Xano API tools while maintaining simple token validation
3. **`oauth-provider`** (current): Uses OAuthProvider for persistent authentication with email/password login

```bash
# For minimal implementation (stable)
git checkout main

# For implementation with Xano tools (recommended for most users)
git checkout xano-tools

# For implementation with persistent OAuth (advanced)
git checkout oauth-provider
```

## Implementation Details

This is the **persistent authentication with OAuthProvider** implementation, which adds the following:

### What This Implementation Does
- **Web-based Authentication Form**: Login with Xano email/password or API token
- **OAuth Flow**: Implements a standard OAuth 2.0 flow for persistent authentication
- **Persistent Tokens**: Maintains authentication state across Durable Object hibernation
- **Token Refreshing**: Automatically handles token expiration and refreshing
- **Connection Resilience**: Reconnects with preserved authentication state

### Advantages Over Other Branches
- **Login UI**: Interactive login with direct email/password or token options
- **Session Management**: Tokens persist even after Worker restarts or Durable Object hibernation
- **User-Friendly**: Better authentication experience for non-technical users
- **Enhanced Security**: Proper token management and storage practices
- **Code Organization**: Uses Hono framework for routing and request handling

## Features

- **Interactive Login Form**: Email/password or API token authentication options
- **OAuth 2.0 Implementation**: Standard authorization_code flow with refresh tokens
- **KV Token Storage**: Secure token storage with proper expiration handling
- **Connection Resilience**: Handles disconnections and hibernation gracefully
- **TypeScript Support**: Full type safety throughout the codebase
- **Debug Endpoints**: Utilities for troubleshooting authentication issues

## Prerequisites

- A Cloudflare account with Workers access and KV storage
- A Xano instance with authentication API endpoint
- npm and wrangler CLI installed

## Project Status and Implementation Progress

### Current Status: Work In Progress

We've made significant progress implementing the OAuth authentication flow for Xano MCP. The current implementation:

1. Successfully handles the initial OAuth authorization with Xano login
2. Presents a clean login UI for email/password or token authentication
3. Successfully connects to and authenticates with the Xano API
4. Implements various Xano MCP tools that use authentication

However, we're still addressing a challenge with the token exchange phase of the OAuth flow, specifically a "Client ID mismatch" error. Our current focus is on fixing this issue while maintaining the clean OAuth architecture.

### Key Insights and Lessons Learned

1. **CloudFlare OAuth Provider Architecture**:
   - CloudFlare's OAuthProvider requires proper client registration and validation
   - The token exchange process has strict client ID validation requirements
   - The GitHub example works because it uses a registered GitHub OAuth app with consistent client IDs

2. **Authentication Flow Implementation**:
   - We've implemented the primary authorization endpoint successfully
   - The token exchange endpoint requires matching client IDs between authorization and token requests
   - Custom client validation via the `lookupClient` method is essential for correct token exchange

3. **Next Implementation Steps**:
   - Complete custom token exchange endpoint to bypass client validation issues
   - Ensure consistent client IDs between authorization and token phases
   - Implement proper token storage and retrieval system

### Setup Instructions

1. Clone this repository:
   ```bash
   git clone https://github.com/roboulos/cloudflare-mcp-server.git
   cd cloudflare-mcp-server
   git checkout oauth-provider
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a KV namespace for token storage:
   ```bash
   npx wrangler kv namespace create OAUTH_KV
   ```

4. Update your wrangler.toml with the KV namespace ID from the previous step:
   ```toml
   [[kv_namespaces]]
   binding = "OAUTH_KV"
   id = "YOUR_KV_NAMESPACE_ID"  # Replace with your actual KV namespace ID
   ```

5. Update your Xano URL in wrangler.toml with your instance's URL:
   ```toml
   [vars]
   XANO_BASE_URL = "https://YOUR-INSTANCE.n7c.xano.io"
   ```

6. Deploy to Cloudflare:
   ```bash
   npx wrangler deploy
   ```

7. Connect using any MCP client (like Claude or Cursor):
   ```
   https://your-worker.your-account.workers.dev/sse
   ```
   You'll see a login form where you can authenticate with Xano credentials

## Authentication Flow

### OAuth Flow

1. A client requests the `/sse` endpoint
2. The OAuthProvider redirects to the `/authorize` endpoint
3. The user is presented with a login form to authenticate with Xano
4. Upon successful authentication, an authorization code is generated
5. The client exchanges the code for access and refresh tokens
6. Tokens are stored in KV for future use
7. The client can reconnect using the tokens, without requiring re-authentication

### Authentication Options

1. **Email/Password Login**: Authenticate using your Xano account credentials
2. **Direct Token Use**: Provide a Xano API token directly
3. **Refresh Token**: Automatically refresh expired tokens

## Key Files

- `src/index.ts`: Main entry point with OAuthProvider and MCP agent setup
- `src/xano-handler.ts`: Handler for OAuth flow and authentication logic
- `src/utils.ts`: Utility functions for API requests and token management
- `wrangler.toml`: Worker configuration with KV and environment settings

## Technical Architecture

The implementation uses Cloudflare's OAuthProvider pattern for authentication persistence:

1. **OAuthProvider** (index.ts)
   - Central hub for OAuth flow and token management
   - Configures routes for authorization, token exchange, and API access
   - Manages token persistence through KV storage

2. **XanoHandler** (xano-handler.ts)
   - Implements the OAuth flow endpoints
   - Handles initial authentication with Xano
   - Manages token lifecycle (creation, storage, refresh)
   - Provides login UI for user authentication

3. **MCP Agent** (index.ts)
   - Implements Xano API tools with authentication checks
   - Uses stored authentication data for API operations
   - Enforces authentication requirements for protected operations

4. **Utilities** (utils.ts)
   - Handles token extraction and validation
   - Provides helper functions for API requests
   - Manages token storage and retrieval from KV

## Authentication Endpoints

- `/authorize`: Presents the login UI and handles initial authentication
- `/token`: Handles the OAuth token exchange
- `/refresh`: Refreshes expired access tokens
- `/oauth-callback`: Handles the OAuth redirect callback
- `/status`: Endpoint to check authentication status
- `/debug-oauth`: Debugging endpoint for OAuth flow issues

## Adding Custom Tools

To add new tools with persistent authentication:

1. Add tool registrations in the `init()` method of `src/index.ts`
2. Check authentication with `this.props?.authenticated`
3. Use the stored API key with `this.props.apiKey` for Xano API calls
4. Add any additional authentication requirements as needed

## Current Development Focus: Solving the Client ID Mismatch

We're actively working on resolving the "Client ID mismatch" error that occurs during the token exchange phase of the OAuth flow. Our current approach involves:

1. **Consistent Client ID Handling**:
   - Ensuring the same client ID is used in both authorization and token exchange phases
   - Setting a default client ID for the CloudFlare playground
   - Implementing a robust `lookupClient` function to handle client validation properly

2. **Custom Token Endpoint Implementation**:
   - Bypassing internal CloudFlare OAuth validation that's causing client ID mismatches
   - Directly handling token exchange with custom response generation
   - Implementing proper error handling with detailed logging

3. **Differences from GitHub Example**:
   - The GitHub example works because it uses a registered GitHub OAuth app with proper client IDs
   - Our implementation needs to handle client validation ourselves since we're authenticating directly with Xano
   - We're exploring different approaches to resolving the client ID validation issues

### Current Workarounds Being Tested

- Custom token endpoint handler that bypasses internal validation
- Auto-approval of all client IDs via the OAuthProvider configuration
- Using consistent client IDs throughout the authorization flow
- Enhanced logging to track the OAuth request through all phases

## Troubleshooting

- **Authentication Failures**: Try clearing browser cookies and localStorage
- **KV Issues**: Verify KV namespace is correctly configured in wrangler.toml
- **Login Problems**: Check that your Xano instance URL is correct
- **Web UI Issues**: Try with a different browser or incognito mode
- **Debugging**: Access `/debug-oauth` endpoint for diagnostic information
- **Client ID Errors**: Check the "Client lookup for ID" logs in the worker logs

### Debugging Endpoints

- `/health`: Check if the server is running correctly
- `/status`: View current authentication status (requires bearer token)
- `/debug-oauth`: Debug endpoint with request and authentication information

## Resources

- [Model Context Protocol (MCP) Documentation](https://github.com/anthropics/model-context-protocol)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare OAuth Provider](https://developers.cloudflare.com/workers/runtime-apis/oauth/)
- [Xano Documentation](https://docs.xano.com/)
- [Hono Documentation](https://hono.dev/)

## Continuing Development

To continue development where we left off:

1. Focus on addressing the token exchange phase with the "Client ID mismatch" error
2. Key files to examine:
   - `src/xano-handler.ts`: Specifically the token endpoint implementation
   - `src/index.ts`: Focus on OAuthProvider configuration and client validation

### Next Steps To Explore

1. Implement a fully custom token endpoint that bypasses the OAuthProvider's internal validation
2. Consider direct manipulation of the KV storage to store authentication data
3. Experiment with different client validation approaches:
   - Using fixed client IDs throughout the flow
   - Custom client registration during authorization
   - More permissive client validation during token exchange

### Logging and Debugging

Use CloudFlare Worker logs to track the token exchange process:
- Look for "Client lookup for ID" logs to see client validation
- Examine "Token endpoint called directly" logs for token exchange details
- Check for "OAuth error response: 400 invalid_grant - Client ID mismatch" errors

## License

MIT