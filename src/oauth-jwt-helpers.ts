/**
 * Helper functions for OAuth JWT refresh functionality
 * These provide clean, testable functions for JWT validation and token management
 */

/**
 * Check if a JWT token is still valid by calling auth/me
 */
export async function checkJWTValidity(authToken: string, baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api:e6emygx3/auth/me`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    return response.ok;
  } catch (error) {
    // Re-throw network errors to be handled by caller
    throw error;
  }
}

/**
 * Delete all authentication tokens from KV storage
 * This forces the OAuth flow to restart on the next request
 */
export async function deleteAllAuthTokens(env: any): Promise<number> {
  const tokenEntries = await env.OAUTH_KV.list({ prefix: 'token:' });
  const xanoAuthEntries = await env.OAUTH_KV.list({ prefix: 'xano_auth_token:' });
  const refreshEntries = await env.OAUTH_KV.list({ prefix: 'refresh:' });
  
  let deletedCount = 0;
  
  // Collect all keys to delete
  const allKeys = [
    ...(tokenEntries.keys || []),
    ...(xanoAuthEntries.keys || []),
    ...(refreshEntries.keys || [])
  ];
  
  // Delete all tokens
  for (const key of allKeys) {
    await env.OAUTH_KV.delete(key.name);
    deletedCount++;
  }
  
  return deletedCount;
}

/**
 * Enhance props with JWT validation check
 * Returns unauthenticated props if JWT is expired to trigger OAuth
 */
export async function enhancePropsWithJWTCheck(props: any, env: any): Promise<any> {
  console.log("🔐 enhancePropsWithJWTCheck called with props:", {
    authenticated: props?.authenticated,
    userId: props?.userId,
    hasApiKey: !!props?.apiKey
  });
  
  // Skip check for unauthenticated requests
  if (!props?.authenticated || !props?.userId) {
    console.log("🔐 Skipping JWT check - not authenticated");
    return props;
  }

  try {
    // Look for auth token in KV
    console.log("🔐 Looking for xano_auth_token entries...");
    const authEntries = await env.OAUTH_KV.list({ prefix: 'xano_auth_token:' });
    console.log("🔐 Found xano_auth_token entries:", authEntries.keys?.length || 0);
    
    if (!authEntries.keys || authEntries.keys.length === 0) {
      console.log("🔐 No xano_auth_token entries found - checking for token: entries");
      const tokenEntries = await env.OAUTH_KV.list({ prefix: 'token:' });
      console.log("🔐 Found token: entries:", tokenEntries.keys?.length || 0);
      
      if (!tokenEntries.keys || tokenEntries.keys.length === 0) {
        console.log("🔐 No auth tokens found at all - skipping JWT check");
        return props;
      }
      
      // Try to use token: entries for JWT checking
      console.log("🔐 Trying to use token: entries for JWT check");
      for (const key of tokenEntries.keys) {
        const tokenDataStr = await env.OAUTH_KV.get(key.name);
        if (tokenDataStr) {
          const tokenData = JSON.parse(tokenDataStr);
          if (tokenData.userId === props.userId && tokenData.accessToken) {
            console.log("🔐 Found JWT in token: entry, checking validity...");
            const isValid = await checkJWTValidity(tokenData.accessToken, env.XANO_BASE_URL);
            
            if (!isValid) {
              console.log("🔐 JWT expired - deleting all tokens to force re-authentication");
              await deleteAllAuthTokens(env);
              return { authenticated: false };
            }
            
            console.log("🔐 JWT is still valid");
            return props;
          }
        }
      }
      
      console.log("🔐 No usable tokens found");
      return props;
    }

    const authDataStr = await env.OAUTH_KV.get(authEntries.keys[0].name);
    if (!authDataStr) {
      return props;
    }

    const authData = JSON.parse(authDataStr);
    if (!authData.authToken) {
      return props;
    }

    // Check JWT validity
    const isValid = await checkJWTValidity(authData.authToken, env.XANO_BASE_URL);
    
    if (!isValid) {
      console.log("JWT expired - deleting all tokens to force re-authentication");
      // JWT expired - delete all tokens
      await deleteAllAuthTokens(env);
      // Return unauthenticated to trigger OAuth
      return { authenticated: false };
    }
    
    // JWT is valid - enhance props with fresh data
    console.log("JWT is still valid");
    return {
      ...props,
      apiKey: authData.apiKey,
      lastRefreshed: authData.lastRefreshed
    };
  } catch (error) {
    // Network error - continue with existing auth
    console.error('Error checking JWT validity:', error);
    return props;
  }
}