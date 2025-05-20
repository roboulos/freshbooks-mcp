# Xano API Key Refresh Implementation

This document explains the automatic API key refresh implementation that resolves authentication issues across worker hibernation in the Cloudflare MCP Server.

## Problem Overview

The Xano MCP Server faced an issue where authentication (specifically the API key) was not persisting properly across worker hibernations. This resulted in authentication failures when making requests to Xano, particularly for advanced operations that required fresh API keys.

The root causes were:

1. **In-memory State Loss** - The in-memory `props` containing authentication data were not persistent across worker hibernations

2. **Token Access Difficulty** - The original auth token needed to call `/auth/me` wasn't stored in an easily retrievable format

3. **Refresh Mechanism** - No automatic mechanism existed to recover from state loss by refreshing from durable KV storage

4. **Token Organization** - Multiple token formats (access tokens, auth tokens, API keys) were stored in different KV structures without clear relationships

## Solution Architecture

The solution implements a transparent, automatic refresh mechanism that:

1. **Runs before each request** - Automatically refreshing the API key before processing any tool request
2. **Uses persistent KV storage** - Accessing tokens stored in Cloudflare KV rather than relying on in-memory data
3. **Updates all related tokens** - Ensuring both access tokens and refresh tokens stay current
4. **Explicitly stores auth tokens** - Now stores the original auth token in a dedicated KV entry

### Key Components

#### 1. `refresh-profile.ts` Module

This module contains the core refresh logic in the `refreshUserProfile` function, which:

- Retrieves authentication data from KV storage (now looks for `xano_auth_token:` prefix first)
- Calls the Xano `auth/me` endpoint to get fresh user data including the API key
- Updates all tokens in KV storage with the fresh data
- Returns success/failure status and the refreshed profile

```typescript
export async function refreshUserProfile(env: any) {
  try {
    // Get the KV binding and base URL
    const OAUTH_KV = env.OAUTH_KV;
    const baseUrl = env.XANO_BASE_URL || "https://xnwv-v1z6-dvnr.n7c.xano.io";
    
    // Try to find our explicitly stored auth token entry
    let authToken = null;
    let authData = null;
    let storageKey = null;  // Track which key we found the token in
    
    // Look for explicit auth token entries first
    const authEntries = await OAUTH_KV.list({ prefix: 'xano_auth_token:' });
    
    if (authEntries.keys?.length > 0) {
      // Use an explicit auth token entry
      storageKey = authEntries.keys[0].name;
      const authDataStr = await OAUTH_KV.get(storageKey);
      authData = JSON.parse(authDataStr);
      authToken = authData.authToken;
    } else {
      // Fall back to standard OAuth tokens
      const tokenEntries = await OAUTH_KV.list({ prefix: 'token:' });
      // ... extract token from standard OAuth storage
    }
    
    // Call auth/me for fresh profile data
    const [userData, errorResponse] = await fetchXanoUserInfo({
      base_url: baseUrl,
      token: authToken,
    });
    
    // Update KV storage with fresh data
    const updatedAuthData = {
      ...authData,
      apiKey: userData.api_key,
      userId: userData.id || authData.userId,
      email: userData.email,
      name: userData.name || userData.email || 'Xano User',
      profile: userData,
      lastRefreshed: new Date().toISOString(),
    };
    
    // For explicit entries, preserve the authToken
    if (storageKey?.startsWith('xano_auth_token:')) {
      updatedAuthData.authToken = authToken;
    }
    
    await OAUTH_KV.put(storageKey, JSON.stringify(updatedAuthData));
    
    // Also update any refresh tokens for the same user
    // ...

    return { success: true, profile: { apiKey, userId, name, email } };
  } catch (error) {
    return { success: false, error: "Error refreshing user profile" };
  }
}
```

#### 2. Enhanced `xano-handler.ts` for Token Storage

The callback handler now explicitly stores the auth token for refresh use:

```typescript
// Store the token explicitly in KV storage for our refresh mechanism
await c.env.OAUTH_KV.put(
    `xano_auth_token:${userId}`,
    JSON.stringify({
        authToken: token,
        apiKey: apiKey,
        userId: userId,
        name: name,
        email: email,
        authenticated: true,
        lastUpdated: new Date().toISOString()
    }),
    { expirationTtl: 604800 } // 7 days
);
```

#### 3. Enhanced `MyMCP` Class with `onNewRequest` Override

The `MyMCP` class now includes an `onNewRequest` method override that:
- Executes before every tool request is processed
- Refreshes authentication data if the user is already authenticated
- Updates the in-memory props with fresh API keys and user profile data
- Falls back to existing props if refresh fails
- Can force re-authentication if refresh consistently fails

```typescript
async onNewRequest(req: Request, env: Env): Promise<[Request, XanoAuthProps, unknown]> {
  // Get initial props from parent method
  const [request, props, ctx] = await super.onNewRequest(req, env);
  
  // Log the props we receive to better understand what's available
  console.log("PROPS IN ON_NEW_REQUEST:", {
    authenticated: props?.authenticated,
    hasAccessToken: !!props?.accessToken,
    accessTokenLength: props?.accessToken ? props.accessToken.length : 0,
    hasApiKey: !!props?.apiKey,
    apiKeyLength: props?.apiKey ? props.apiKey.length : 0,
    userId: props?.userId,
    propKeys: props ? Object.keys(props) : []
  });
  
  // If we're authenticated and there's a need to refresh
  if (props?.authenticated) {
    try {
      // Check if we need to refresh (no apiKey or it's been too long)
      const needsRefresh = !props.apiKey || 
                          !props.lastRefreshed || 
                          (new Date().getTime() - new Date(props.lastRefreshed).getTime() > 3600000); // 1 hour
      
      if (needsRefresh) {
        console.log("Refreshing user profile...");
        const refreshResult = await refreshUserProfile(env);
        
        if (refreshResult.success) {
          console.log("Profile refresh successful");
          // Update props with refreshed data
          return [
            request, 
            { 
              ...props,
              apiKey: refreshResult.profile.apiKey,
              userId: refreshResult.profile.userId,
              name: refreshResult.profile.name,
              email: refreshResult.profile.email,
              lastRefreshed: new Date().toISOString()
            }, 
            ctx
          ];
        } else {
          console.error("Profile refresh failed:", refreshResult.error);
          // If token is explicitly missing, force re-authentication
          if (refreshResult.error.includes("No auth token found") || 
              refreshResult.error.includes("Auth token not found")) {
            console.log("Forcing re-authentication due to missing token");
            return [
              request,
              {
                ...props,
                authenticated: false, // Force re-authentication
                accessToken: undefined,
                apiKey: undefined
              } as XanoAuthProps,
              ctx
            ];
          }
        }
      }
    } catch (error) {
      console.error("Error in onNewRequest refresh:", error);
      // Log error but continue with existing props
    }
  }
  
  // Return original values if not authenticated or refresh not needed/failed
  return [request, props, ctx];
}
```

#### 4. Debugging Tools

For diagnostic purposes, several debugging tools are included:

- `debug_auth` - Shows the current authentication state, including API key prefix
- `debug_refresh_profile` - Manually triggers a profile refresh for testing
- `debug_kv_storage` - Examines the KV storage contents to verify token storage and format

## Deployment

To deploy this solution:

1. Ensure your Cloudflare worker has the required environment bindings:
   - `OAUTH_KV` - KV namespace for storing authentication data
   - `XANO_BASE_URL` - Base URL for your Xano instance

2. Deploy with Wrangler:
   ```
   npx wrangler deploy
   ```

## Testing and Verification

After deployment, you can verify the refresh mechanism is working by:

1. Authenticating through the OAuth flow
2. Using the `debug_auth` tool to check initial authentication
3. Using the `debug_refresh_profile` tool to confirm the refresh mechanism works
4. Checking KV storage for `xano_auth_token:` entries with `wrangler kv:namespace list` and `wrangler kv:key list --binding=OAUTH_KV`

## Implementation Details

### Token Flow and Storage Architecture

The implementation uses several token types that work together:

1. **Auth Token** - Retrieved during initial login with email/password via `/auth/login`
   - Used to call the `/auth/me` endpoint to get the API key
   - Stored in KV with prefix `xano_auth_token:${userId}`
   - Contains all user profile data including the auth token and API key

2. **API Key** - Retrieved from `/auth/me` endpoint response
   - Used for all tool requests to Xano
   - Stored both in KV and in-memory props
   - Synchronized during refresh operations

3. **Access Token** - OAuth token created during the OAuth flow
   - Used for client authentication
   - Stored with prefix `token:${accessToken}`
   - Links to the same user and profile data

The solution ensures that if any of these tokens is available, it can refresh the full authentication state.

### Refresh Trigger Mechanism

Refresh operations are triggered when:

1. The `onNewRequest` method determines refresh is needed based on:
   - Missing API key
   - Expired refresh timeframe (default: 1 hour)
   - Explicit refresh token tool is called

2. Worker hibernation occurs, causing in-memory props to be lost

3. Manual refresh is triggered via the debug tool

## Known Limitations

1. **Token Expiration** - Auth tokens have a 7-day expiration, requiring re-authentication after that period

2. **Worker Hibernation** - Multiple worker instances may have different in-memory states, though they all access the same KV storage

3. **Refresh Frequency** - To minimize API calls, refreshes are only triggered once per hour by default (configurable)

4. **KV Storage Limitations** - Cloudflare KV has eventual consistency which could cause race conditions in extremely high traffic scenarios

## Notes and Caveats

1. **Error Handling** - The refresh mechanism fails gracefully, continuing with existing authentication when refresh fails

2. **Debugging** - The implementation includes extensive logging to help troubleshoot authentication issues

3. **Transparent Operation** - The refresh process happens automatically without requiring tool users to invoke it manually

4. **KV Dependency** - This implementation relies on Cloudflare KV for persistent storage, which is ideal for this use case with infrequent writes and frequent reads

5. **Automatic vs. Manual Refresh** - While the refresh happens automatically on every request, the `debug_refresh_profile` tool allows for manual testing and verification

The refresh mechanism ensures consistent authentication across worker hibernations while maintaining compatibility with all existing tools.