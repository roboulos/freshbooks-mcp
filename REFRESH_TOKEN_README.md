# Xano API Key Refresh Implementation

This document explains the automatic API key refresh implementation that resolves authentication issues across worker hibernation in the Cloudflare MCP Server.

## Problem Overview

The Xano MCP Server faced an issue where authentication (specifically the API key) was not persisting properly across worker hibernations. This resulted in authentication failures when making requests to Xano, particularly for advanced operations that required fresh API keys.

The root cause was that the in-memory `props` containing the authentication data were not persistent across worker hibernations, while the more durable KV storage needed to be regularly synchronized with fresh authentication data from the Xano API.

## Solution Architecture

The solution implements a transparent, automatic refresh mechanism that:

1. **Runs before each request** - Automatically refreshing the API key before processing any tool request
2. **Uses persistent KV storage** - Accessing tokens stored in Cloudflare KV rather than relying on in-memory data
3. **Updates all related tokens** - Ensuring both access tokens and refresh tokens stay current

### Key Components

#### 1. `refresh-profile.ts` Module

This module contains the core refresh logic in the `refreshUserProfile` function, which:

- Retrieves authentication data from KV storage
- Calls the Xano `auth/me` endpoint to get fresh user data including the API key
- Updates all tokens in KV storage with the fresh data
- Returns success/failure status and the refreshed profile

```typescript
export async function refreshUserProfile(env: any) {
  try {
    // Get the KV binding and base URL
    const OAUTH_KV = env.OAUTH_KV;
    const baseUrl = env.XANO_BASE_URL || "https://xnwv-v1z6-dvnr.n7c.xano.io";
    
    // List tokens and get the latest one
    const listResult = await OAUTH_KV.list({ prefix: 'token:' });
    const tokenKey = listResult.keys[0].name;
    const authDataStr = await OAUTH_KV.get(tokenKey);
    const authData = JSON.parse(authDataStr);
    const accessToken = authData.accessToken;
    
    // Call auth/me for fresh profile data
    const [userData, errorResponse] = await fetchXanoUserInfo({
      base_url: baseUrl,
      token: accessToken,
    });
    
    // Update KV storage with fresh API key and profile data
    const updatedAuthData = {
      ...authData,
      apiKey: userData.api_key,
      userId: userData.id || authData.userId,
      email: userData.email,
      name: userData.name || userData.email || 'Xano User',
      profile: userData,
      lastRefreshed: new Date().toISOString(),
    };
    await OAUTH_KV.put(tokenKey, JSON.stringify(updatedAuthData));
    
    // Also update any refresh tokens for the same user
    // ...

    return { success: true, profile: { apiKey, userId, name, email } };
  } catch (error) {
    return { success: false, error: "Error refreshing user profile" };
  }
}
```

#### 2. Enhanced `MyMCP` Class with `onNewRequest` Override

The `MyMCP` class now includes an `onNewRequest` method override that:
- Executes before every tool request is processed
- Refreshes authentication data if the user is already authenticated
- Updates the in-memory props with fresh API keys and user profile data
- Falls back to existing props if refresh fails

```typescript
async onNewRequest(req: Request, env: Env): Promise<[Request, XanoAuthProps, unknown]> {
  // Get initial props from parent method
  const [request, props, ctx] = await super.onNewRequest(req, env);
  
  // If authenticated, refresh profile
  if (props?.authenticated) {
    try {
      const refreshResult = await refreshUserProfile(env);
      
      if (refreshResult.success) {
        // Update props with refreshed data
        return [
          request, 
          { 
            ...props,
            apiKey: refreshResult.profile.apiKey,
            userId: refreshResult.profile.userId,
            name: refreshResult.profile.name,
            email: refreshResult.profile.email
          }, 
          ctx
        ];
      }
    } catch (error) {
      // Log error but continue
    }
  }
  
  // Return original values if not authenticated or refresh failed
  return [request, props, ctx];
}
```

#### 3. Debugging Tools

For diagnostic purposes, two debugging tools are included:

- `debug_auth` - Shows the current authentication state, including API key prefix
- `debug_refresh_profile` - Manually triggers a profile refresh for testing

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
3. Letting the worker hibernate (typically 15-30 minutes of inactivity)
4. Making a tool request (like `xano_list_databases`) that should trigger automatic refresh
5. Verifying with `debug_auth` that the API key is now refreshed

## Notes and Caveats

1. **Error Handling** - The refresh mechanism fails gracefully, continuing with existing authentication when refresh fails

2. **Debugging** - The implementation includes extensive logging to help troubleshoot authentication issues

3. **Transparent Operation** - The refresh process happens automatically without requiring tool users to invoke it manually

4. **KV Dependency** - This implementation relies on Cloudflare KV for persistent storage, which is ideal for this use case with infrequent writes and frequent reads

5. **Automatic vs. Manual Refresh** - While the refresh happens automatically on every request, the `debug_refresh_profile` tool allows for manual testing and verification

The refresh mechanism ensures consistent authentication across worker hibernations while maintaining compatibility with all existing tools.