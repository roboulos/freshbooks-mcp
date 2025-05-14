# OAuth Implementation Details

This document provides technical details about the OAuth 2.0 implementation used in the Cloudflare MCP server for persistent authentication with Xano.

## Authentication Architecture

The authentication system is built on Cloudflare's OAuthProvider pattern, which enables persistent authentication across Durable Object hibernation periods. This ensures that users don't need to re-authenticate every time the Durable Object wakes up after periods of inactivity.

### Core Components

1. **OAuthProvider** (index.ts)
   - Configured as the default export from the worker
   - Manages the OAuth flow and token persistence
   - Routes authentication requests to appropriate endpoints
   - Maintains connection with authenticated state

2. **XanoHandler** (xano-handler.ts)
   - Implements OAuth endpoints (authorize, token, refresh)
   - Provides the login UI for user authentication
   - Handles Xano API authentication (both email/password and token methods)
   - Manages token storage in KV with appropriate expiration

3. **KV Storage**
   - Stores access and refresh tokens with prefixes
   - Maintains token state across worker restarts
   - Implements proper expiration for security

4. **Hono Framework**
   - Provides routing and middleware capabilities
   - Handles request/response processing
   - Simplifies endpoint implementation

## OAuth Flow Implementation

### 1. Authorization Endpoint (`/authorize`)

The authorization endpoint presents a login form where users can authenticate using either:
- Xano email and password
- Direct API token input

```typescript
app.get('/authorize', async (c) => {
  const clientId = c.req.query('client_id');
  const redirectUri = c.req.query('redirect_uri');
  const state = c.req.query('state');
  const responseType = c.req.query('response_type');
  const error = c.req.query('error');
  
  // Render login form with both email/password and token options
  // Authenticate with Xano
  // Generate authorization code
  // Redirect to callback URL with code
});
```

When authentication succeeds:
1. An authorization code is generated
2. The user is redirected to the callback URL with the code
3. The code is temporarily stored in KV with a short expiration

### 2. Token Endpoint (`/token`)

The token endpoint exchanges an authorization code for access and refresh tokens:

```typescript
app.post('/token', async (c) => {
  // Extract grant_type, code, redirect_uri, client_id
  // Validate the authorization code
  // Generate access and refresh tokens
  // Store tokens in KV with appropriate expiration
  // Return tokens in standard OAuth response format
});
```

Key aspects:
- Supports both JSON and form-encoded requests
- Uses standard OAuth 2.0 response format
- Stores tokens with proper prefixes in KV
- Sets appropriate expiration times

### 3. Refresh Endpoint (`/refresh`)

The refresh endpoint allows clients to obtain a new access token using a refresh token:

```typescript
app.post('/refresh', async (c) => {
  // Extract refresh token
  // Validate refresh token from KV
  // Generate new access token
  // Update KV storage
  // Return new access token and refresh token
});
```

## Token Storage Pattern

Tokens are stored in KV with specific prefixes and optimized for retrieval:

1. **Authorization Codes**:
   - Prefix: `auth_code:`
   - Expiration: 10 minutes
   - Format: `auth_code:{code} -> {clientId}:{redirectUri}`

2. **Access Tokens**:
   - Prefix: `access_token:`
   - Expiration: 60 minutes (configurable)
   - Format: `access_token:{token} -> {userData JSON}`

3. **Refresh Tokens**:
   - Prefix: `refresh_token:`
   - Expiration: 30 days (configurable)
   - Format: `refresh_token:{token} -> {accessToken}`

## Request Authentication Flow

1. Client makes request to `/sse` endpoint
2. OAuthProvider checks for existing authentication
3. If not authenticated, redirects to `/authorize`
4. User authenticates with Xano
5. Authorization code is exchanged for tokens
6. Subsequent requests use the access token
7. If token expires, refresh flow is triggered

## Xano Authentication Methods

### Email/Password Authentication

The server authenticates with Xano's API using email and password:

```typescript
async function authenticateWithXano(email, password) {
  const response = await fetch(`${XANO_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  
  if (!response.ok) {
    // Handle authentication error
  }
  
  const data = await response.json();
  return data.authToken; // Extract API token
}
```

### Direct Token Authentication

Alternatively, users can provide a Xano API token directly:

```typescript
async function validateXanoToken(token) {
  // Make a test API call to verify token validity
  const response = await fetch(`${XANO_BASE_URL}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  
  return response.ok; // Return true if token is valid
}
```

## Security Considerations

1. **Token Expiration**: Access tokens expire after 60 minutes
2. **HTTPS Enforcement**: All authentication is done over HTTPS
3. **Token Storage**: Tokens are stored with appropriate KV expiration
4. **Error Handling**: Detailed error handling for security issues
5. **No Sensitive Data Exposure**: Login credentials never stored, only tokens
6. **Token Validation**: All tokens validated before use

## Debug Endpoints

For troubleshooting authentication issues, the implementation includes debug endpoints:

1. **Status Endpoint** (`/status`):
   - Returns current authentication status
   - Requires bearer token for access
   - Shows token expiration information

2. **Debug OAuth Endpoint** (`/debug-oauth`):
   - Shows detailed OAuth flow information
   - Displays headers and request parameters
   - Helps diagnose authentication issues

## Usage Example

```javascript
// Client-side code to connect to the MCP server with authentication
const mcp = new MCPAgent({
  url: "https://your-worker.your-account.workers.dev/sse",
  // Authentication is handled by the server-side OAuth flow
  // No manual token management needed on client side
});

// The connection will automatically:
// 1. Redirect to login if needed
// 2. Maintain authentication state
// 3. Refresh tokens as needed
// 4. Reconnect with preserved auth state
```

## Implementation Decisions

1. **Why OAuthProvider?**: Provides persistent authentication across Durable Object hibernation
2. **Why KV Storage?**: Reliable, low-latency storage for tokens with proper expiration
3. **Why Web UI Login?**: More user-friendly than requiring API token knowledge
4. **Why Authorization Code Flow?**: More secure than implicit flow, following OAuth best practices
5. **Why Refresh Tokens?**: Allows for long-lived sessions without compromising security

## Additional Customization

The OAuth implementation can be customized by modifying:
- Token expiration times in `xano-handler.ts`
- Login form UI in the `/authorize` endpoint
- Token storage patterns in the token-related endpoints
- Authentication validation logic in utility functions