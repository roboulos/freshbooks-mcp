import { Hono } from 'hono';
import { extractToken } from "./utils";
import { XanoAuthProps } from "./index";

// Create a Hono app for better routing
const app = new Hono();

// Custom type for OAuth request info
type AuthRequest = {
  clientId: string;
  redirectUri: string;
  responseType: string;
  state: string;
};

// Utility to encode/decode state data
function encodeState(data: any): string {
  try {
    const jsonString = JSON.stringify(data);
    return btoa(jsonString);
  } catch (e) {
    console.error('Error encoding state:', e);
    throw new Error('Could not encode state');
  }
}

function decodeState<T = any>(encoded: string): T {
  try {
    const jsonString = atob(encoded);
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('Error decoding state:', e);
    throw new Error('Could not decode state');
  }
}

// Helper function to generate the login form HTML
function loginForm(oauthState: string, errorMessage?: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xano Authentication</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f9f9f9;
      margin: 0;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      padding: 30px;
      width: 100%;
      max-width: 400px;
    }
    h1 {
      color: #333;
      margin-top: 0;
      text-align: center;
      font-size: 24px;
      margin-bottom: 20px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #444;
    }
    input[type="email"],
    input[type="password"],
    input[type="text"] {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 16px;
      box-sizing: border-box;
    }
    button {
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 12px 20px;
      font-size: 16px;
      width: 100%;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    button:hover {
      background-color: #0069d9;
    }
    .error {
      color: #dc3545;
      margin: 0 0 20px;
      padding: 10px;
      background-color: #f8d7da;
      border: 1px solid #f5c6cb;
      border-radius: 4px;
    }
    .logo {
      text-align: center;
      margin-bottom: 20px;
    }
    .logo img {
      max-width: 120px;
    }
    .divider {
      margin: 30px 0;
      border-top: 1px solid #eee;
      position: relative;
    }
    .divider span {
      position: absolute;
      top: -10px;
      background: white;
      padding: 0 10px;
      left: 50%;
      transform: translateX(-50%);
      color: #777;
    }
    .alt-method {
      text-align: center;
      margin-top: 20px;
      font-size: 14px;
      color: #777;
    }
    .alt-method a {
      color: #007bff;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>Xano MCP Server</h1>
    </div>
    
    <form action="/authorize" method="GET">
      <input type="hidden" name="oauth_state" value="${oauthState}">
      
      ${errorMessage ? `<div class="error">${errorMessage}</div>` : ''}
      
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required autocomplete="email">
      </div>
      
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required autocomplete="current-password">
      </div>
      
      <button type="submit">Sign In</button>
    </form>
    
    <div class="divider">
      <span>OR</span>
    </div>
    
    <div class="alt-method">
      If you have a Xano API token, you can <a href="#" id="use-token">use it directly</a>.
    </div>
    
    <div id="token-form" style="display: none; margin-top: 20px;">
      <div class="form-group">
        <label for="auth_token">API Token</label>
        <input type="text" id="auth_token" name="auth_token">
      </div>
      <button id="submit-token" type="button">Authenticate with Token</button>
    </div>
  </div>
  
  <script>
    // Handle OAuth state parameter extraction
    const urlParams = new URLSearchParams(window.location.search);
    const oauthParams = {};
    
    // Copy all OAuth parameters to the form
    ['client_id', 'redirect_uri', 'response_type', 'state'].forEach(param => {
      const value = urlParams.get(param);
      if (value) {
        oauthParams[param] = value;
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = param;
        input.value = value;
        document.querySelector('form').appendChild(input);
      }
    });
    
    // Toggle token input
    document.getElementById('use-token').addEventListener('click', function(e) {
      e.preventDefault();
      const tokenForm = document.getElementById('token-form');
      if (tokenForm.style.display === 'none') {
        tokenForm.style.display = 'block';
      } else {
        tokenForm.style.display = 'none';
      }
    });
    
    // Handle token submission
    document.getElementById('submit-token').addEventListener('click', function() {
      const token = document.getElementById('auth_token').value;
      if (!token) {
        alert('Please enter a valid API token');
        return;
      }
      
      // Build redirect URL with token and OAuth params
      const url = new URL(window.location.href);
      url.searchParams.set('auth_token', token);
      
      // Add all OAuth params
      Object.entries(oauthParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
      
      // Redirect to authorization with token
      window.location.href = url.toString();
    });
  </script>
</body>
</html>`;
}

// Handle OAuth authorization endpoint
app.get('/authorize', async (c) => {
  const request = c.req.raw;
  try {
    console.log('Authorization endpoint called');
    
    // Parse OAuth request parameters
    const params = new URL(request.url).searchParams;
    const redirectUri = params.get('redirect_uri');
    const clientId = params.get('client_id');
    const responseType = params.get('response_type');
    const state = params.get('state');
    
    console.log('OAuth parameters:', { redirectUri, clientId, responseType, state });
    
    // Validate OAuth request parameters
    if (!redirectUri || !clientId || responseType !== 'code' || !state) {
      console.error('Invalid OAuth request parameters');
      return c.text('Invalid OAuth request parameters', 400);
    }

    // Save OAuth request info in a cookie for later use
    const encodedOAuthInfo = encodeState({
      clientId,
      redirectUri,
      responseType,
      state
    });
    
    // Check if this is a login form submission
    const email = params.get('email');
    const password = params.get('password');
    
    // If we have email and password, try to authenticate with Xano
    if (email && password) {
      try {
        console.log('Processing login with email/password');
        
        // Call Xano login endpoint
        const loginResponse = await fetch(`${c.env.XANO_BASE_URL}/api:e6emygx3/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email,
            password
          })
        });
        
        if (!loginResponse.ok) {
          console.error('Xano login failed:', await loginResponse.text());
          // Show login form again with error
          return new Response(
            loginForm(encodedOAuthInfo, 'Invalid email or password. Please try again.'),
            {
              status: 401,
              headers: { 'Content-Type': 'text/html' }
            }
          );
        }
        
        // Extract user data with token
        const userData = await loginResponse.json();
        console.log('Login successful, user data received:', JSON.stringify(userData));
        
        const token = userData.authToken || userData.api_key;
        
        if (!token) {
          console.error('No token in Xano response');
          return new Response(
            loginForm(encodedOAuthInfo, 'Authentication succeeded but no token was returned.'),
            {
              status: 500,
              headers: { 'Content-Type': 'text/html' }
            }
          );
        }
        
        // Create authorization code
        const authCode = crypto.randomUUID();
        console.log('Generated auth code:', authCode);
        
        // Auth data to store
        const authData = {
          apiKey: token,
          userId: userData.id || 'xano_user',
          authenticated: true,
          userDetails: {
            name: userData.name || null,
            email: userData.email || email
          }
        };
        
        // Store auth data for token exchange
        const authCodeKey = `auth_code:${authCode}`;
        console.log('Storing auth data with key:', authCodeKey);
        
        await c.env.OAUTH_KV.put(
          authCodeKey,
          JSON.stringify(authData),
          { expirationTtl: 600 } // 10 minute code expiration
        );
        
        // Double-check the data was stored
        const storedData = await c.env.OAUTH_KV.get(authCodeKey);
        console.log('Verified auth code storage:', !!storedData);
        
        // Redirect back to client with code
        const redirectURL = new URL(redirectUri);
        redirectURL.searchParams.set('code', authCode);
        redirectURL.searchParams.set('state', state);
        
        console.log('Redirecting to:', redirectURL.toString());
        return Response.redirect(redirectURL.toString(), 302);
      } catch (error) {
        console.error('Error authenticating with Xano:', error);
        return new Response(
          loginForm(encodedOAuthInfo, 'Server error during authentication. Please try again.'),
          {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
          }
        );
      }
    }
    
    // Get token from request (if provided directly)
    const token = extractToken(request);
    if (token) {
      try {
        console.log('Processing direct token authentication');
        
        // Verify token with Xano
        const response = await fetch(`${c.env.XANO_BASE_URL}/api:e6emygx3/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          console.error('Token validation failed:', await response.text());
          // Token is invalid, show login form
          return new Response(
            loginForm(encodedOAuthInfo, 'Invalid token. Please login with your credentials.'),
            {
              status: 401,
              headers: { 'Content-Type': 'text/html' }
            }
          );
        }
        
        // Extract user data
        const userData = await response.json();
        console.log('Token validation successful, user data received');
        
        // Create authorization code
        const authCode = crypto.randomUUID();
        console.log('Generated auth code:', authCode);
        
        // Auth data to store
        const authData = {
          apiKey: userData.api_key || token,
          userId: userData.id || 'xano_user',
          authenticated: true,
          userDetails: {
            name: userData.name || null,
            email: userData.email || null
          }
        };
        
        // Store auth data for token exchange
        const authCodeKey = `auth_code:${authCode}`;
        console.log('Storing auth data with key:', authCodeKey);
        
        await c.env.OAUTH_KV.put(
          authCodeKey,
          JSON.stringify(authData),
          { expirationTtl: 600 } // 10 minute code expiration
        );
        
        // Double-check the data was stored
        const storedData = await c.env.OAUTH_KV.get(authCodeKey);
        console.log('Verified auth code storage:', !!storedData);
        
        // Redirect back to client with code
        const redirectURL = new URL(redirectUri);
        redirectURL.searchParams.set('code', authCode);
        redirectURL.searchParams.set('state', state);
        
        console.log('Redirecting to:', redirectURL.toString());
        return Response.redirect(redirectURL.toString(), 302);
      } catch (error) {
        console.error('Error validating token:', error);
        // Show login form on error
        return new Response(
          loginForm(encodedOAuthInfo, 'Error validating token. Please login with your credentials.'),
          {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
          }
        );
      }
    }
    
    console.log('No credentials provided, showing login form');
    // No token or credentials provided, show login form
    return new Response(
      loginForm(encodedOAuthInfo),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  } catch (error) {
    console.error('Error in /authorize endpoint:', error);
    return c.text('Server error during authorization', 500);
  }
});

// Handle token exchange
app.post('/token', async (c) => {
  try {
    console.log('Token endpoint called');
    
    // Extract request body - handle both JSON and form URL encoded formats
    let body;
    const contentType = c.req.header('Content-Type') || '';
    
    if (contentType.includes('application/json')) {
      body = await c.req.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await c.req.formData();
      body = Object.fromEntries(formData.entries());
    } else {
      // Try to parse as JSON anyway as fallback
      try {
        body = await c.req.json();
      } catch (e) {
        console.error('Could not parse request body:', e);
        return c.json({ error: 'unsupported_content_type' }, 400);
      }
    }
    
    console.log('Received token request body:', JSON.stringify(body));
    const { code, grant_type, client_id, redirect_uri } = body;
    
    // Validate token request
    if (grant_type !== 'authorization_code' || !code) {
      console.error('Invalid token request parameters:', { grant_type, code, client_id });
      return c.json({ 
        error: 'invalid_request',
        error_description: 'Missing required parameters' 
      }, 400);
    }
    
    // Get stored auth data
    const authCodeKey = `auth_code:${code}`;
    console.log('Looking for auth code with key:', authCodeKey);
    const authDataStr = await c.env.OAUTH_KV.get(authCodeKey);
    
    if (!authDataStr) {
      console.error('Auth code not found:', code);
      return c.json({ 
        error: 'invalid_grant',
        error_description: 'Authorization code is invalid or expired'
      }, 400);
    }
    
    console.log('Found auth data for code');
    
    // Parse auth data
    const authData = JSON.parse(authDataStr) as XanoAuthProps;
    console.log('Auth data parsed successfully', { userId: authData.userId, authenticated: authData.authenticated });
    
    // Generate tokens
    const accessToken = crypto.randomUUID();
    const refreshToken = crypto.randomUUID();
    
    // Store tokens with auth data in KV
    const accessKey = `access:${accessToken}`;
    const refreshKey = `refresh:${refreshToken}`;
    
    console.log('Storing access token with key:', accessKey);
    await c.env.OAUTH_KV.put(
      accessKey,
      JSON.stringify(authData),
      { expirationTtl: 86400 } // 24 hour access token
    );
    
    console.log('Storing refresh token with key:', refreshKey);
    await c.env.OAUTH_KV.put(
      refreshKey,
      JSON.stringify(authData),
      { expirationTtl: 2592000 } // 30 day refresh token
    );
    
    // Delete used auth code
    console.log('Deleting used auth code:', authCodeKey);
    await c.env.OAUTH_KV.delete(authCodeKey);
    
    // Return token response
    console.log('Returning successful token response');
    return new Response(
      JSON.stringify({
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 86400,
        refresh_token: refreshToken
      }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  } catch (error) {
    console.error('Error in /token endpoint:', error);
    return c.json({ 
      error: 'server_error',
      error_description: 'An error occurred processing the request'
    }, 500);
  }
});

// Handle refresh token
app.post('/refresh', async (c) => {
  try {
    console.log('Refresh token endpoint called');
    
    // Extract request body - handle both JSON and form URL encoded formats
    let body;
    const contentType = c.req.header('Content-Type') || '';
    
    if (contentType.includes('application/json')) {
      body = await c.req.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await c.req.formData();
      body = Object.fromEntries(formData.entries());
    } else {
      // Try to parse as JSON anyway as fallback
      try {
        body = await c.req.json();
      } catch (e) {
        console.error('Could not parse refresh request body:', e);
        return c.json({ error: 'unsupported_content_type' }, 400);
      }
    }
    
    console.log('Received refresh token request body:', JSON.stringify(body));
    const { refresh_token, grant_type, client_id } = body;
    
    // Validate refresh request
    if (grant_type !== 'refresh_token' || !refresh_token) {
      console.error('Invalid refresh parameters:', { grant_type, refresh_token, client_id });
      return c.json({ 
        error: 'invalid_request',
        error_description: 'Missing required parameters for token refresh' 
      }, 400);
    }
    
    // Get auth data from refresh token
    const refreshKey = `refresh:${refresh_token}`;
    console.log('Looking for refresh token with key:', refreshKey);
    const authDataStr = await c.env.OAUTH_KV.get(refreshKey);
    
    if (!authDataStr) {
      console.error('Refresh token not found:', refresh_token);
      return c.json({ 
        error: 'invalid_grant',
        error_description: 'Refresh token is invalid or expired'
      }, 400);
    }
    
    console.log('Found auth data for refresh token');
    
    // Parse auth data
    const authData = JSON.parse(authDataStr) as XanoAuthProps;
    console.log('Auth data parsed successfully');
    
    // Check if API key is still valid by making a Xano request
    let isValid = false;
    try {
      console.log('Validating Xano token');
      const validationResponse = await fetch(`${c.env.XANO_BASE_URL}/api:e6emygx3/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authData.apiKey}`
        }
      });
      isValid = validationResponse.ok;
      console.log('Xano token validation result:', isValid);
    } catch (e) {
      console.warn('Could not validate Xano token, but proceeding with refresh:', e);
      isValid = true; // Proceed anyway to avoid locking out users
    }
    
    if (!isValid) {
      console.error('Xano token is no longer valid');
      await c.env.OAUTH_KV.delete(refreshKey);
      return c.json({ 
        error: 'invalid_grant', 
        error_description: 'Xano API key is no longer valid' 
      }, 400);
    }
    
    // Generate new tokens
    const accessToken = crypto.randomUUID();
    const newRefreshToken = crypto.randomUUID();
    
    // Store new tokens with auth data
    const accessKey = `access:${accessToken}`;
    const newRefreshKey = `refresh:${newRefreshToken}`;
    
    console.log('Storing new access token with key:', accessKey);
    await c.env.OAUTH_KV.put(
      accessKey,
      JSON.stringify(authData),
      { expirationTtl: 86400 } // 24 hour access token
    );
    
    console.log('Storing new refresh token with key:', newRefreshKey);
    await c.env.OAUTH_KV.put(
      newRefreshKey,
      JSON.stringify(authData),
      { expirationTtl: 2592000 } // 30 day refresh token
    );
    
    // Delete old refresh token
    console.log('Deleting old refresh token:', refreshKey);
    await c.env.OAUTH_KV.delete(refreshKey);
    
    // Return new tokens
    console.log('Returning new tokens');
    return new Response(
      JSON.stringify({
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 86400,
        refresh_token: newRefreshToken
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  } catch (error) {
    console.error('Error in /refresh endpoint:', error);
    return c.json({ 
      error: 'server_error',
      error_description: 'An error occurred processing the refresh request'
    }, 500);
  }
});

// Handle client registration
app.post('/register', async (c) => {
  try {
    // Simple client registration - returns static client ID for Xano MCP
    return c.json({
      client_id: 'xano-mcp-client',
      client_secret: crypto.randomUUID(), // New secret each time
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0 // No expiration
    });
  } catch (error) {
    console.error('Error in /register endpoint:', error);
    return c.json({ error: 'server_error' }, 500);
  }
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', server: 'Xano MCP OAuth Server' });
});

// OAuth callback endpoint
app.get('/oauth-callback', async (c) => {
  // This is where the client gets redirected after authorization
  // Display a simple success page with script to send message back to opener
  const params = new URL(c.req.url).searchParams;
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  
  if (error) {
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Authentication Error</title>
        <style>
          body { font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
          .container { max-width: 500px; margin: 50px auto; padding: 20px; text-align: center; }
          .error { color: #dc3545; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Authentication Error</h1>
          <p class="error">${error}</p>
          <p>Please close this window and try again.</p>
          <script>
            // Send error message to opener window
            if (window.opener) {
              window.opener.postMessage({
                type: 'mcp_auth_callback',
                success: false,
                error: "${error}"
              }, '*');
              // Close this window after a short delay
              setTimeout(() => window.close(), 2000);
            }
          </script>
        </div>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  if (!code || !state) {
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Invalid Callback</title>
        <style>
          body { font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
          .container { max-width: 500px; margin: 50px auto; padding: 20px; text-align: center; }
          .error { color: #dc3545; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Invalid OAuth Callback</h1>
          <p class="error">Missing code or state parameter.</p>
          <p>Please close this window and try again.</p>
          <script>
            // Send error message to opener window
            if (window.opener) {
              window.opener.postMessage({
                type: 'mcp_auth_callback',
                success: false,
                error: "Missing code or state parameter"
              }, '*');
              // Close this window after a short delay
              setTimeout(() => window.close(), 2000);
            }
          </script>
        </div>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  // Success case - pass the code and state back to the opener window
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Authentication Successful</title>
      <style>
        body { font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
        .container { max-width: 500px; margin: 50px auto; padding: 20px; text-align: center; }
        .success { color: #28a745; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Authentication Successful</h1>
        <p class="success">You have successfully authenticated with Xano.</p>
        <p>You can close this window now.</p>
        <script>
          // Send success message to opener window with code and state
          if (window.opener) {
            window.opener.postMessage({
              type: 'mcp_auth_callback',
              success: true,
              code: "${code}",
              state: "${state}"
            }, '*');
            // Close this window after a short delay
            setTimeout(() => window.close(), 2000);
          }
        </script>
      </div>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
});

// Debug endpoint
app.all('/debug-oauth', async (c) => {
  try {
    // Return a simple success response for debugging
    return new Response(
      JSON.stringify({
        debug: true,
        timestamp: new Date().toISOString(),
        message: "Debug endpoint is working",
        request: {
          method: c.req.method,
          url: c.req.url,
          path: new URL(c.req.url).pathname
        }
      }, null, 2),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Debug error',
        message: error.message,
        stack: error.stack
      }, null, 2),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  }
});

// Status info endpoint (useful for debugging)
app.get('/status', async (c) => {
  // Get token from Authorization header
  const authHeader = c.req.header('Authorization');
  let accessToken = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.substring(7);
  }
  
  if (!accessToken) {
    return c.json({ authenticated: false, message: 'No access token provided' });
  }
  
  try {
    // Look up token in KV storage
    const authDataStr = await c.env.OAUTH_KV.get(`access:${accessToken}`);
    if (!authDataStr) {
      return c.json({ authenticated: false, message: 'Invalid or expired token' });
    }
    
    const authData = JSON.parse(authDataStr) as XanoAuthProps;
    
    return c.json({
      authenticated: true,
      userId: authData.userId,
      hasApiKey: !!authData.apiKey
    });
  } catch (error) {
    console.error('Error checking authentication status:', error);
    return c.json({ authenticated: false, error: 'Error retrieving authentication status' });
  }
});

// Class to handle fetch requests using the Hono app
export class XanoHandlerClass {
  async fetch(request: Request, env: any) {
    // Create a custom execution context with the environment
    return app.fetch(request, env);
  }
}

// Export handler instance
export const XanoHandler = new XanoHandlerClass();