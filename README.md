# Xano MCP Server with Persistent Authentication

A Cloudflare Workers-based MCP (Model Context Protocol) server that authenticates with Xano and maintains persistent authentication state across Durable Object hibernation using OAuthProvider. This server enables AI assistants like Claude to securely interact with your Xano backend even after periods of inactivity.

✅ **WORKING IMPLEMENTATION**: This branch now contains a fully functional OAuth implementation that successfully connects to the CloudFlare AI Playground with Xano authentication.

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
- **API Key Extraction**: Properly extracts and uses the Xano API key from auth/me response

### Advantages Over Other Branches
- **Login UI**: Interactive login with direct email/password or token options
- **Session Management**: Tokens persist even after Worker restarts or Durable Object hibernation
- **User-Friendly**: Better authentication experience for non-technical users
- **Enhanced Security**: Proper token management and storage practices
- **Code Organization**: Uses Hono framework for routing and request handling
- **Compatibility**: Works with both AI Playground and Claude Desktop applications

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

### Current Status: Working Implementation

The OAuth implementation for the Xano MCP server is now successfully working with the CloudFlare AI Playground and other MCP clients. The implementation:

1. Successfully handles the full OAuth authorization flow with Xano login
2. Presents a clean login UI with email/password or token authentication options
3. Maintains consistent client ID throughout the OAuth flow
4. Resolves the "Client ID mismatch" error during token exchange
5. Properly preserves state across the OAuth flow's multiple redirects
6. Implements client approval with cookie-based storage for returning users

For detailed information on how the OAuth implementation works, check out the [OAuth Implementation Documentation](./OAUTH_IMPLEMENTATION.md).

### Key Insights and Lessons Learned

1. **CloudFlare OAuth Provider Architecture**:
   - Success came from following CloudFlare's GitHub OAuth example pattern exactly
   - The OAuth flow required preserving state consistently through all redirects
   - Client ID must be consistent between authorization and token exchange phases

2. **Authentication Flow Implementation**:
   - Added a client approval dialog before the Xano login form
   - Implemented a multi-step flow: approval → login → callback
   - Used base64-encoded state parameters to preserve OAuth context through redirects
   - Added robust cookie-based approval storage for returning users

3. **State Management**:
   - Maintaining state throughout the OAuth flow was crucial
   - Cookie encryption required an additional environment variable
   - Client approval cookies improve the experience for returning users

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

5. Update your Xano URL in wrangler.toml with your instance's URL, and set a COOKIE_ENCRYPTION_KEY for the client approval feature:
   ```toml
   [vars]
   XANO_BASE_URL = "https://YOUR-INSTANCE.n7c.xano.io"
   COOKIE_ENCRYPTION_KEY = "your-secret-key-for-cookie-encryption"
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

## Implementation Approach: Resolving the Client ID Mismatch

We successfully resolved the "Client ID mismatch" error by implementing the following solutions:

1. **Following the GitHub Example Pattern Exactly**:
   - Implemented the multi-step OAuth flow exactly as in the CloudFlare GitHub OAuth example
   - Used the same file structure and approach but adapted for Xano authentication
   - Created approval, login, and callback steps in the exact same pattern

2. **State Preservation Through All Redirects**:
   - Encoded the full OAuth request info in state parameters
   - Passed state through each step of the flow consistently
   - Reconstructed the original authorization request during the callback

3. **Client ID Consistency**:
   - Maintained the same client ID throughout the entire OAuth flow
   - Implemented a `lookupClient` function that preserves the original client ID
   - Used the same client ID during both authorization and token exchange

See the [OAuth Implementation Documentation](./OAUTH_IMPLEMENTATION.md) for a detailed technical explanation of how this solution works.

## API Key Extraction and Claude Integration

### API Key Extraction Fix

We implemented a crucial fix that properly extracts the Xano API key from the `/auth/me` response:

1. **Problem**: Initially, the OAuth flow was using the authentication token from the `/auth/login` endpoint for both authentication and API access, but Xano requires the special API key returned by `/auth/me` for Meta API operations.

2. **Solution**:
   - Modified the callback handler to extract `userData.api_key` from the `/auth/me` response
   - Added proper fallback to the auth token if the API key is not present
   - Enhanced logging to verify API key extraction

3. **Implementation**:
   - In `xano-handler.ts`, the callback function now explicitly extracts the API key:
   ```typescript
   const apiKey = userData.api_key || token;
   ```
   - This API key is then stored in the OAuth props and made available to all MCP tools

### Working with Claude Applications

This implementation has been verified to work with:

1. **CloudFlare AI Playground**:
   - Direct integration through the `/sse` endpoint
   - Full OAuth flow with Xano authentication
   - Allows use of all Xano tools

2. **Claude Desktop**:
   - Connect using the server URL: `https://your-worker.your-account.workers.dev/sse`
   - You'll be directed through the same OAuth flow
   - Xano tools will be available in the desktop interface
   - Authentication persists across sessions

3. **Integration Notes**:
   - The first connection will trigger the OAuth flow with login
   - Subsequent connections will use stored tokens if available
   - Client approval cookies reduce login frequency for returning users
   - API key is properly stored and used for all Xano API operations

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

## Future Enhancements

Now that we have a working implementation, here are possible future enhancements:

1. **UI Improvements**:
   - Better error messaging in the login form
   - Enhanced styling for the approval dialog
   - Mobile-responsive improvements

2. **Security Enhancements**:
   - More robust validation of tokens and credentials
   - CSRF protection for the login form
   - Rate limiting for authentication attempts

3. **Additional Features**:
   - Explicit logout functionality
   - User profile access in the MCP tools
   - More sophisticated cookie management for approvals

### Maintenance and Updates

When updating this implementation:
- Be careful with the OAuth flow structure - any changes should maintain the same pattern
- Test thoroughly with the CloudFlare AI Playground after any changes
- Check the CloudFlare workers-oauth-provider package for updates
- Be cautious with modifying state preservation logic

### Logging and Monitoring

Use CloudFlare Worker logs to monitor the OAuth flow:
- Look for "Client lookup called with ID" logs to track client validation
- Monitor authorization flow steps through the console logs
- Track successful authentication events and any error patterns

## License

MIT