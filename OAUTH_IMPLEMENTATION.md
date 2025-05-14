# OAuth Implementation for Xano MCP Server

This document explains the OAuth implementation used in the Xano MCP Server, which follows CloudFlare's GitHub OAuth example pattern to resolve client ID mismatch issues.

## Overview

The Xano MCP Server implements an OAuth 2.0 authorization code flow to allow secure access to Xano APIs through the CloudFlare AI Playground and other clients. This implementation follows the pattern established in CloudFlare's GitHub OAuth example (https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-github-oauth).

## Key Components

1. **OAuthProvider Configuration** (`src/index.ts`):
   - Sets up the OAuth provider with endpoints for authorization, token exchange, and client registration
   - Implements a custom `lookupClient` function that preserves client IDs throughout the OAuth flow

2. **Xano Handler** (`src/xano-handler.ts`):
   - Creates routes for handling the OAuth authorization flow
   - Implements the client approval dialog
   - Manages the Xano-specific authentication process
   - Preserves OAuth state throughout redirects

3. **OAuth Utilities** (`src/workers-oauth-utils.ts`):
   - Handles client approval through cookies
   - Renders the approval dialog
   - Manages state encoding/decoding and cookie security

4. **Xano Utilities** (`src/utils.ts`):
   - Provides functions for authenticating with Xano
   - Defines the Props type for storing authenticated user data
   - Implements API utility functions

## Authentication Flow

The authentication flow follows these steps:

1. **Client Requests Authorization**:
   - A client (e.g., CloudFlare AI Playground) initiates authorization by sending a request to `/authorize`
   - The request includes client_id, redirect_uri, and other OAuth parameters

2. **Approval Dialog**:
   - If the client hasn't been approved before, an approval dialog is shown
   - User can approve or deny the client's access request
   - OAuth request parameters are preserved in the state

3. **Xano Authentication**:
   - After approval, the user is redirected to a Xano login form
   - User can authenticate with email/password or direct API token
   - Authentication is done via Xano's authentication endpoints

4. **Authorization Completion**:
   - After successful authentication, the flow continues to the callback endpoint
   - The original OAuth request is reconstructed from the state
   - The authorization is completed with the user's Xano token and ID
   - User is redirected back to the client application with an authorization code

5. **Token Exchange**:
   - The client exchanges the authorization code for access tokens
   - The token is used for subsequent API requests to the MCP server

## Key Implementation Details

### State Preservation

The OAuth flow preserves state through base64-encoded JSON objects passed in URL parameters. This ensures the client ID and other OAuth parameters remain consistent throughout redirects:

```typescript
// Encode state for passing through redirects
const state = btoa(JSON.stringify(oauthReqInfo));
```

### Client Approval

User approval for clients is managed through encrypted cookies, allowing returning users to skip the approval step:

```typescript
// Check if client is already approved
if (await clientIdAlreadyApproved(request, clientId, cookieSecret)) {
  // Skip approval dialog
}
```

### Client ID Consistency

The implementation ensures the same client ID is used throughout the flow by:

1. Storing the client ID in the request state
2. Recovering it during the callback
3. Using a consistent `lookupClient` function that preserves client IDs:

```typescript
lookupClient: async (clientId) => {
  const validClientId = clientId || "playground-client";
  return {
    id: validClientId,
    // ...other client properties
  };
}
```

## Environment Variables

The implementation requires these environment variables:

- `XANO_BASE_URL`: The base URL for your Xano instance
- `COOKIE_ENCRYPTION_KEY`: Secret key for encrypting approval cookies

## Troubleshooting

### Client ID Mismatch Errors

If you encounter "Client ID mismatch" errors during token exchange:

1. Ensure the same client ID is being passed through all steps of the flow
2. Check the implementation of the `lookupClient` function
3. Verify that state is being correctly encoded and decoded during redirects

### Authentication Failures

If authentication with Xano fails:

1. Check the XANO_BASE_URL environment variable
2. Verify the authentication API endpoints are correct
3. Check browser console for any CORS or network errors

## Lessons Learned

1. **Importance of State Preservation**: The OAuth flow relies heavily on preserving state across multiple redirects. Any loss of state can break the flow.

2. **Client ID Consistency**: The client ID must remain consistent from the initial authorization request through the token exchange.

3. **CloudFlare OAuth Provider Pattern**: Following CloudFlare's established patterns (like the GitHub OAuth example) is crucial for compatibility with their tools.

4. **Cookie-Based Approvals**: Using cookies for storing client approvals improves the user experience for returning users.

5. **Environment Variables**: Proper environment variable management is essential for secure cookie encryption and API access.

## Acknowledgements

This implementation adapts CloudFlare's GitHub OAuth example pattern to work with Xano's authentication system. Special thanks to the CloudFlare team for providing the example implementation that helped resolve the client ID mismatch issues.

## References

- [CloudFlare GitHub OAuth Example](https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-github-oauth)
- [OAuth 2.0 Authorization Code Grant](https://oauth.net/2/grant-types/authorization-code/)
- [CloudFlare Workers OAuth Provider](https://github.com/cloudflare/workers-sdk/tree/main/packages/workers-oauth-provider)