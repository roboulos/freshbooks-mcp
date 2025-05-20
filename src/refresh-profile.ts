import { fetchXanoUserInfo } from "./utils";

/**
 * Refreshes the user profile by calling the auth/me endpoint and updating the KV storage
 * This function can be called during request handling to ensure the API key is fresh
 */
export async function refreshUserProfile(env: any) {
  try {
    // Get the KV binding and base URL
    const OAUTH_KV = env.OAUTH_KV;
    const baseUrl = env.XANO_BASE_URL || "https://xnwv-v1z6-dvnr.n7c.xano.io";
    
    if (!OAUTH_KV) {
      console.error("KV storage not available for profile refresh");
      return { success: false, error: "KV storage not available" };
    }

    // List all token entries in KV storage
    const listResult = await OAUTH_KV.list({ prefix: 'token:' });
    if (!listResult.keys || listResult.keys.length === 0) {
      console.error("No authentication tokens found for profile refresh");
      return { success: false, error: "No authentication tokens found" };
    }

    // Get the latest token entry
    const tokenKey = listResult.keys[0].name;
    const authDataStr = await OAUTH_KV.get(tokenKey);
    
    if (!authDataStr) {
      console.error(`Token data not found for key: ${tokenKey}`);
      return { success: false, error: "Token data not found" };
    }

    // Parse the authentication data
    const authData = JSON.parse(authDataStr);
    const accessToken = authData.accessToken;
    
    if (!accessToken) {
      console.error("No access token found in stored authentication data");
      return { success: false, error: "No access token found" };
    }

    console.log("Refreshing user profile with access token...");
    
    // Call auth/me with the access token to get the fresh user data
    const [userData, errorResponse] = await fetchXanoUserInfo({
      base_url: baseUrl,
      token: accessToken,
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

    await OAUTH_KV.put(tokenKey, JSON.stringify(updatedAuthData));

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