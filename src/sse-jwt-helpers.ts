/**
 * JWT validation helpers for SSE message interception
 * These functions handle JWT checking during tool execution via onSSEMcpMessage
 */

interface TokenSearchResult {
  found: boolean;
  authToken: string | null;
  source: 'xano_auth_token' | 'token' | null;
}

interface InterceptResult {
  shouldContinue: boolean;
  error: string | null;
  updatedProps: any;
}

/**
 * Check for JWT tokens in KV storage using both possible prefixes
 * First checks xano_auth_token: entries, then falls back to token: entries
 */
export async function checkAuthTokensInKV(env: any, userId: string): Promise<TokenSearchResult> {
  // First, check xano_auth_token: prefix (our custom storage)
  const xanoKeys = await env.OAUTH_KV.list({ prefix: 'xano_auth_token:' });
  
  if (xanoKeys.keys && xanoKeys.keys.length > 0) {
    // Look for a key matching this user
    for (const key of xanoKeys.keys) {
      const data = await env.OAUTH_KV.get(key.name);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.userId === userId && parsed.authToken) {
          return {
            found: true,
            authToken: parsed.authToken,
            source: 'xano_auth_token'
          };
        }
      }
    }
  }

  // Fallback to token: prefix (OAuth provider's storage)
  const tokenKeys = await env.OAUTH_KV.list({ prefix: 'token:' });
  
  if (tokenKeys.keys && tokenKeys.keys.length > 0) {
    for (const key of tokenKeys.keys) {
      const data = await env.OAUTH_KV.get(key.name);
      if (data) {
        const parsed = JSON.parse(data);
        // Check both accessToken (production) and authToken (legacy) fields
        if (parsed.userId === userId && (parsed.accessToken || parsed.authToken)) {
          return {
            found: true,
            authToken: parsed.accessToken || parsed.authToken,
            source: 'token'
          };
        }
      }
    }
  }

  return {
    found: false,
    authToken: null,
    source: null
  };
}

/**
 * Check JWT validity with Xano auth/me endpoint
 */
async function checkJWTWithXano(authToken: string, baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api:e6emygx3/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.ok && response.status === 200;
  } catch (error) {
    // Network errors should not be treated as auth failures
    console.error('Network error checking JWT:', error);
    return true; // Assume valid on network error to avoid blocking
  }
}

/**
 * Delete all auth-related tokens from KV storage
 */
async function deleteAllAuthTokens(env: any): Promise<void> {
  // Delete xano_auth_token: entries
  const xanoKeys = await env.OAUTH_KV.list({ prefix: 'xano_auth_token:' });
  if (xanoKeys.keys) {
    for (const key of xanoKeys.keys) {
      await env.OAUTH_KV.delete(key.name);
    }
  }

  // Delete token: entries
  const tokenKeys = await env.OAUTH_KV.list({ prefix: 'token:' });
  if (tokenKeys.keys) {
    for (const key of tokenKeys.keys) {
      await env.OAUTH_KV.delete(key.name);
    }
  }

  // Delete refresh: entries
  const refreshKeys = await env.OAUTH_KV.list({ prefix: 'refresh:' });
  if (refreshKeys.keys) {
    for (const key of refreshKeys.keys) {
      await env.OAUTH_KV.delete(key.name);
    }
  }
}

/**
 * Main function to intercept SSE messages and check JWT validity
 * This is called from onSSEMcpMessage override in the McpAgent
 */
export async function interceptSSEMessage(
  sessionId: string,
  request: Request,
  props: any,
  env: any
): Promise<InterceptResult> {
  // Skip JWT check for unauthenticated requests
  if (!props?.authenticated || !props?.userId) {
    return {
      shouldContinue: true,
      error: null,
      updatedProps: props
    };
  }

  try {
    // First check if we have an API key in props (this is the JWT!)
    let jwtToken: string | null = null;
    
    // The JWT is stored as apiKey in props!
    if (props.apiKey) {
      console.log('🔍 Found JWT in props.apiKey, checking validity...');
      jwtToken = props.apiKey;
    } else {
      // Fallback to checking KV storage
      const tokenResult = await checkAuthTokensInKV(env, props.userId);
      
      if (tokenResult.found) {
        console.log(`🔍 Found JWT in ${tokenResult.source} storage, checking validity...`);
        jwtToken = tokenResult.authToken;
      }
    }
    
    if (!jwtToken) {
      console.error('🔐 No JWT found anywhere! Setting unauthenticated state...');
      // If we're authenticated but have no JWT, force re-auth
      await deleteAllAuthTokens(env);
      return {
        shouldContinue: true, // Let tools handle the unauthenticated state
        error: 'No authentication token found. Please reconnect to re-authenticate.',
        updatedProps: {
          ...props,
          authenticated: false,
          apiKey: null
        }
      };
    }

    // Check if JWT is still valid with Xano
    const isValid = await checkJWTWithXano(jwtToken, env.XANO_BASE_URL);

    if (!isValid) {
      console.error('🔐 JWT expired! Clearing tokens and blocking execution...');
      
      // Delete all auth tokens
      await deleteAllAuthTokens(env);

      // Don't block - just update props to unauthenticated
      return {
        shouldContinue: true, // Let tools handle the unauthenticated state
        error: 'Authentication expired. Please reconnect to re-authenticate.',
        updatedProps: {
          ...props,
          authenticated: false,
          authToken: null,
          apiKey: null
        }
      };
    }

    console.log('✅ JWT is still valid, continuing with tool execution');
    return {
      shouldContinue: true,
      error: null,
      updatedProps: props
    };

  } catch (error) {
    console.error('Error during JWT interception:', error);
    // On unexpected errors, continue to avoid blocking
    return {
      shouldContinue: true,
      error: null,
      updatedProps: props
    };
  }
}