import { Hono } from "hono";
import { extractToken } from "./utils";

export const XanoAuthHandler = new Hono();

// Handle authorization requests
XanoAuthHandler.get("/authorize", async (c) => {
  // Parse OAuth request from the incoming request
  const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  if (!oauthReqInfo) {
    return c.text("Invalid OAuth request", 400);
  }

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
    
    // Create auth data with API key
    const authData = {
      apiKey: userData.api_key,
      userId: userData.id || 'xano_user',
      authenticated: true
    };
    
    // Complete authorization with OAuthProvider
    return c.env.OAUTH_PROVIDER.completeAuthorization(c.req.raw, authData);
  } catch (error) {
    console.error('Error validating token:', error);
    return c.text("Error validating token", 500);
  }
});

// Handle token requests (for OAuth flow)
XanoAuthHandler.post("/token", async (c) => {
  return c.env.OAUTH_PROVIDER.handleTokenRequest(c.req.raw);
});

// Handle token refresh (for OAuth flow)
XanoAuthHandler.post("/refresh", async (c) => {
  return c.env.OAUTH_PROVIDER.handleTokenRequest(c.req.raw);
});

// Retrieve current authentication state
XanoAuthHandler.get("/status", async (c) => {
  try {
    const authProps = await c.env.OAUTH_PROVIDER.getAuthProps(c.req.raw);
    
    if (!authProps) {
      return c.json({ authenticated: false });
    }
    
    return c.json({
      authenticated: true,
      userId: authProps.userId
    });
  } catch (error) {
    console.error('Error getting auth status:', error);
    return c.json({ authenticated: false, error: "Error retrieving authentication status" });
  }
});