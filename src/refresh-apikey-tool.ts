import { Context } from "hono";
import { fetchXanoUserInfo } from "./utils";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Register the API key refresh tool
 */
export function registerApiKeyRefreshTool(server: McpServer) {
  server.tool(
    "xano_refresh_apikey",
    {},
    async (_params: any, c: Context) => {
      try {
        // Get environment variables
        const OAUTH_KV = c.env.OAUTH_KV;
        const baseUrl = c.env.XANO_BASE_URL || "https://xnwv-v1z6-dvnr.n7c.xano.io";

        if (!OAUTH_KV) {
          return c.json({
            success: false,
            error: "KV storage not available",
          }, 500);
        }

        // List all token entries in KV storage
        const listResult = await OAUTH_KV.list({ prefix: 'token:' });
        if (!listResult.keys || listResult.keys.length === 0) {
          return c.json({
            success: false,
            error: "No authentication tokens found in storage",
          }, 404);
        }

        // Get the most recent token entry
        const tokenKey = listResult.keys[0].name;
        const authDataStr = await OAUTH_KV.get(tokenKey);
        
        if (!authDataStr) {
          return c.json({
            success: false,
            error: `Token data not found for key: ${tokenKey}`,
          }, 404);
        }

        // Parse the authentication data
        const authData = JSON.parse(authDataStr);
        const accessToken = authData.accessToken;
        
        if (!accessToken) {
          return c.json({
            success: false,
            error: "No access token found in stored authentication data",
          }, 400);
        }

        // Call auth/me with the access token to get the fresh API key
        const [userData, errorResponse] = await fetchXanoUserInfo({
          base_url: baseUrl,
          token: accessToken,
        });

        if (errorResponse || !userData) {
          return c.json({
            success: false,
            error: "Failed to refresh API key: auth/me request failed",
            details: errorResponse ? await errorResponse.text() : "No user data returned",
          }, errorResponse ? errorResponse.status : 500);
        }

        if (!userData.api_key) {
          return c.json({
            success: false,
            error: "API key not found in auth/me response",
          }, 500);
        }

        // Get the fresh API key from the response
        const apiKey = userData.api_key;
        const userId = userData.id || authData.userId;

        // Update the auth data in KV
        const updatedAuthData = {
          ...authData,
          apiKey,
          userId,
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
                // Update the API key in the refresh token entry
                const updatedRefreshData = {
                  ...refreshData,
                  apiKey,
                  lastRefreshed: new Date().toISOString(),
                };
                await OAUTH_KV.put(key.name, JSON.stringify(updatedRefreshData));
              }
            } catch (error) {
              console.error(`Error updating refresh token ${key.name}:`, error);
            }
          }
        }

        return c.json({
          success: true,
          message: "API key successfully refreshed in KV storage",
        });
      } catch (error) {
        console.error("Error in xano_refresh_apikey:", error);
        return c.json({
          success: false,
          error: `Failed to refresh API key: ${error.message || "Unknown error"}`,
        }, 500);
      }
    }
  );
}