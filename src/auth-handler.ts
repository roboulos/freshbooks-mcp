import { Hono } from "hono";
import { extractToken } from "./utils";

export const XanoAuthHandler = new Hono();

// Handle the authorize endpoint for backward compatibility
XanoAuthHandler.get("/authorize", async (c) => {
  // Get token from request
  const token = extractToken(c.req.raw);
  if (!token) {
    return c.text("Missing auth token", 400);
  }

  try {
    // Validate token with Xano
    const response = await fetch(`${c.env.XANO_BASE_URL}/api:e6emygx3/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      return c.text("Invalid Xano token", 401);
    }
    
    // Parse the Xano auth response to get the user data
    const userData = await response.json();
    
    // For direct OAuth API endpoints
    if (c.req.query("client_id") && c.req.query("response_type") === "code") {
      const state = c.req.query("state");
      const redirectUri = c.req.query("redirect_uri");
      
      if (!state || !redirectUri) {
        return c.text("Invalid OAuth request", 400);
      }
      
      // Create a custom OAuth authorization response
      const authCode = crypto.randomUUID();
      
      // Store the auth data for later token exchange
      await c.env.OAUTH_KV.put(
        `auth_code:${authCode}`,
        JSON.stringify({
          apiKey: userData.api_key,
          userId: userData.id || 'xano_user',
          authenticated: true,
          redirectUri
        }),
        { expirationTtl: 600 } // 10 minute expiration
      );
      
      // Redirect back to the client with the code
      const redirectUrl = new URL(redirectUri);
      redirectUrl.searchParams.set("code", authCode);
      redirectUrl.searchParams.set("state", state);
      
      return c.redirect(redirectUrl.toString());
    }
    
    // Standard response for direct API calls
    return c.json({
      apiKey: userData.api_key,
      userId: userData.id || 'xano_user',
      authenticated: true
    });
  } catch (error) {
    console.error('Error validating token:', error);
    return c.text("Error validating token", 500);
  }
});

// Handle token exchange
XanoAuthHandler.post("/token", async (c) => {
  try {
    const body = await c.req.json();
    const { code, grant_type, redirect_uri } = body;
    
    if (grant_type !== "authorization_code" || !code) {
      return c.json({ error: "invalid_request" }, 400);
    }
    
    // Retrieve the auth data from the code
    const authDataStr = await c.env.OAUTH_KV.get(`auth_code:${code}`);
    if (!authDataStr) {
      return c.json({ error: "invalid_grant" }, 400);
    }
    
    const authData = JSON.parse(authDataStr);
    
    // Verify the redirect URI matches
    if (authData.redirectUri !== redirect_uri) {
      return c.json({ error: "invalid_grant" }, 400);
    }
    
    // Generate access token
    const accessToken = crypto.randomUUID();
    const refreshToken = crypto.randomUUID();
    
    // Store the auth data against the access token
    await c.env.OAUTH_KV.put(
      `token:${accessToken}`,
      JSON.stringify({
        apiKey: authData.apiKey,
        userId: authData.userId,
        authenticated: true
      }),
      { expirationTtl: 86400 } // 24 hour expiration
    );
    
    // Store refresh token
    await c.env.OAUTH_KV.put(
      `refresh:${refreshToken}`,
      JSON.stringify({
        apiKey: authData.apiKey,
        userId: authData.userId,
        authenticated: true
      }),
      { expirationTtl: 2592000 } // 30 day expiration
    );
    
    // Delete the used auth code
    await c.env.OAUTH_KV.delete(`auth_code:${code}`);
    
    return c.json({
      access_token: accessToken,
      token_type: "bearer",
      expires_in: 86400,
      refresh_token: refreshToken
    });
  } catch (error) {
    console.error('Error handling token request:', error);
    return c.json({ error: "server_error" }, 500);
  }
});

// Handle refresh token
XanoAuthHandler.post("/refresh", async (c) => {
  try {
    const body = await c.req.json();
    const { refresh_token, grant_type } = body;
    
    if (grant_type !== "refresh_token" || !refresh_token) {
      return c.json({ error: "invalid_request" }, 400);
    }
    
    // Retrieve the auth data from the refresh token
    const authDataStr = await c.env.OAUTH_KV.get(`refresh:${refresh_token}`);
    if (!authDataStr) {
      return c.json({ error: "invalid_grant" }, 400);
    }
    
    const authData = JSON.parse(authDataStr);
    
    // Generate new access token
    const accessToken = crypto.randomUUID();
    const newRefreshToken = crypto.randomUUID();
    
    // Store the auth data against the new access token
    await c.env.OAUTH_KV.put(
      `token:${accessToken}`,
      JSON.stringify({
        apiKey: authData.apiKey,
        userId: authData.userId,
        authenticated: true
      }),
      { expirationTtl: 86400 } // 24 hour expiration
    );
    
    // Store new refresh token
    await c.env.OAUTH_KV.put(
      `refresh:${newRefreshToken}`,
      JSON.stringify({
        apiKey: authData.apiKey,
        userId: authData.userId,
        authenticated: true
      }),
      { expirationTtl: 2592000 } // 30 day expiration
    );
    
    // Delete the used refresh token
    await c.env.OAUTH_KV.delete(`refresh:${refresh_token}`);
    
    return c.json({
      access_token: accessToken,
      token_type: "bearer",
      expires_in: 86400,
      refresh_token: newRefreshToken
    });
  } catch (error) {
    console.error('Error handling refresh token request:', error);
    return c.json({ error: "server_error" }, 500);
  }
});

// Status endpoint
XanoAuthHandler.get("/status", async (c) => {
  const authHeader = c.req.header("Authorization");
  let accessToken = null;
  
  if (authHeader && authHeader.startsWith("Bearer ")) {
    accessToken = authHeader.substring(7);
  }
  
  if (!accessToken) {
    return c.json({ authenticated: false });
  }
  
  try {
    // Look up token in KV
    const authDataStr = await c.env.OAUTH_KV.get(`token:${accessToken}`);
    
    if (!authDataStr) {
      return c.json({ authenticated: false });
    }
    
    const authData = JSON.parse(authDataStr);
    
    return c.json({
      authenticated: true,
      userId: authData.userId
    });
  } catch (error) {
    console.error('Error checking authentication status:', error);
    return c.json({ authenticated: false, error: "Error retrieving authentication status" });
  }
});