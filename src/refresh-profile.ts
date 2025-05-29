import { fetchXanoUserInfo } from "./utils";

/**
 * Refreshes the user profile by calling the auth/me endpoint and updating the KV storage
 * This function can be called during request handling to ensure the API key is fresh
 */
export async function refreshUserProfile(env: any, userId?: string) {
  try {
    // TODO: This function should require userId parameter to properly scope KV queries
    // Currently it searches across ALL users which is a security risk
    // Get the KV binding and base URL
    const OAUTH_KV = env.OAUTH_KV;
    const baseUrl = env.XANO_BASE_URL || "https://xnwv-v1z6-dvnr.n7c.xano.io";
    
    if (!OAUTH_KV) {
      console.error("KV storage not available for profile refresh");
      return { success: false, error: "KV storage not available" };
    }

    // Try to find our explicitly stored auth token entry
    let authToken = null;
    let authData = null;
    let storageKey = null;  // Track which key we found the token in
    
    try {
      // Look for xano_auth_token entries
      const authEntries = await OAUTH_KV.list({ prefix: 'xano_auth_token:' });
      
      if (authEntries.keys && authEntries.keys.length > 0) {
        console.log(`Found ${authEntries.keys.length} explicit auth token entries`);
        // Use the first auth token entry
        storageKey = authEntries.keys[0].name;
        const authDataStr = await OAUTH_KV.get(storageKey);
        
        if (authDataStr) {
          authData = JSON.parse(authDataStr);
          const userId = authData.userId;
          authToken = authData.authToken;
          
          if (authToken) {
            console.log(`Found stored auth token for user ${userId} in key ${storageKey}`);
          } else {
            console.error("Auth token entry found but token is missing");
            return { success: false, error: "Auth token not found in stored data" };
          }
        } else {
          console.error(`Auth data not found for key: ${storageKey}`);
          return { success: false, error: "Auth data not found" };
        }
      } else {
        // Fall back to looking for token: entries
        console.log("No explicit auth token entries found, trying legacy format");
        const listResult = await OAUTH_KV.list({ prefix: 'token:' });
        
        if (!listResult.keys || listResult.keys.length === 0) {
          console.error("No authentication tokens found for profile refresh");
          return { success: false, error: "No authentication tokens found" };
        }
        
        // Get the latest token entry
        storageKey = listResult.keys[0].name;
        
        // Get the stored data for this token
        const authDataStr = await OAUTH_KV.get(storageKey);
        
        if (!authDataStr) {
          console.error(`Token data not found for key: ${storageKey}`);
          return { success: false, error: "Token data not found" };
        }
        
        // Parse the authentication data
        authData = JSON.parse(authDataStr);
        
        // Extract the authToken (stored as accessToken in props)
        authToken = authData.accessToken;
        
        if (!authToken) {
          console.error("No auth token found in stored authentication data");
          return { success: false, error: "No auth token found" };
        }
      }
    } catch (error) {
      console.error("Error finding auth token:", error);
      return { success: false, error: `Error finding auth token: ${error.message}` };
    }
    
    if (!authToken) {
      return { success: false, error: "Auth token not found after all attempts" };
    }
    
    console.log("Found auth token for refreshing user profile:", {
      authTokenPrefix: authToken.substring(0, 5) + '...',
      tokenLength: authToken.length,
      baseUrl
    });
    
    // Call auth/me with the auth token to get the fresh user data
    const [userData, errorResponse] = await fetchXanoUserInfo({
      base_url: baseUrl,
      token: authToken,
    });

    if (errorResponse || !userData) {
      console.error("Failed to refresh user profile: auth/me request failed", 
        errorResponse ? await errorResponse.text() : "No user data returned");
      return { 
        success: false, 
        error: "Failed to refresh user profile"
      };
    }

    if (!userData.api_key) {
      console.error("API key not found in auth/me response");
      return { success: false, error: "API key not found in response" };
    }

    // Extract all relevant profile information
    const userId = userData.id || authData.userId;
    const apiKey = userData.api_key;
    const email = userData.email;
    const name = userData.name || userData.email || 'Xano User';

    // Update the auth data in KV
    const updatedAuthData = {
      ...authData,
      apiKey,
      userId,
      email,
      name,
      profile: userData, // Store full profile data
      lastRefreshed: new Date().toISOString(),
    };

    // If this is an xano_auth_token entry, make sure we preserve the authToken field
    if (storageKey && storageKey.startsWith('xano_auth_token:')) {
      updatedAuthData.authToken = authToken;
    }

    console.log(`Updating auth data in storage key: ${storageKey}`);
    await OAUTH_KV.put(storageKey, JSON.stringify(updatedAuthData));

    // Also update any refresh tokens for the same user
    const refreshTokensResult = await OAUTH_KV.list({ prefix: 'refresh:' });
    for (const key of refreshTokensResult.keys || []) {
      const refreshDataStr = await OAUTH_KV.get(key.name);
      if (refreshDataStr) {
        try {
          const refreshData = JSON.parse(refreshDataStr);
          if (refreshData.userId === userId) {
            // Update all profile data in the refresh token entry
            const updatedRefreshData = {
              ...refreshData,
              apiKey,
              email,
              name,
              profile: userData,
              lastRefreshed: new Date().toISOString(),
            };
            await OAUTH_KV.put(key.name, JSON.stringify(updatedRefreshData));
          }
        } catch (error) {
          console.error(`Error updating refresh token ${key.name}:`, error);
        }
      }
    }

    console.log("User profile successfully refreshed");
    return { 
      success: true, 
      profile: {
        apiKey,
        userId,
        name,
        email
      }
    };
  } catch (error) {
    console.error("Error refreshing user profile:", error);
    return { 
      success: false, 
      error: `Error refreshing user profile: ${error.message || "Unknown error"}`
    };
  }
}