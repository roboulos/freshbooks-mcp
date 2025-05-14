import { Hono } from 'hono';
import { XanoAuthProps } from "./index";

// Create a Hono app for better routing
const app = new Hono();

// Helper function to generate the login form HTML
function loginForm(state: string, errorMessage?: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Snappy MCP Authentication</title>
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
      <h1>Snappy MCP Server</h1>
    </div>
    
    <form action="/authorize" method="GET">
      <input type="hidden" name="state" value="${state}">
      
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
    // Handle token input toggle
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
      
      // Build redirect URL with token
      const url = new URL(window.location.href);
      url.searchParams.set('auth_token', token);
      
      // Redirect to authorization with token
      window.location.href = url.toString();
    });
  </script>
</body>
</html>`;
}

// Handle OAuth authorization endpoint
app.get('/authorize', async (c) => {
  try {
    console.log('Authorization endpoint called');
    
    // Always parse the OAuth request first (this is what CloudFlare example does)
    const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
    console.log('Parsed OAuth request info:', oauthReqInfo);
    
    // Extract the form or query parameters for later usage
    let formData;
    try {
      // Try to parse form data if available (POST request)
      const contentType = c.req.header('Content-Type') || '';
      if (contentType.includes('application/x-www-form-urlencoded')) {
        formData = await c.req.parseBody();
      }
    } catch (error) {
      console.log('Error parsing form data:', error);
    }

    // We need to ensure we're using a consistent client ID through both authorization and token exchange
    // Default to the playground client ID if none is provided
    const clientId = oauthReqInfo.clientId || "xXjCNLDsDV4VB2nG";
    oauthReqInfo.clientId = clientId;
    console.log('Setting consistent client ID for entire flow:', clientId);

    // Set a consistent redirect URI
    if (!oauthReqInfo.redirectUri) {
      oauthReqInfo.redirectUri = "https://playground.ai.cloudflare.com/oauth/callback";
      console.log('Added default redirect URI');
    }

    if (!oauthReqInfo.responseType) {
      oauthReqInfo.responseType = "code";
      console.log('Added default response type');
    }
    
    // Get query parameters 
    const params = new URL(c.req.url).searchParams;
    
    // Check if this is a login form submission
    const email = params.get('email');
    const password = params.get('password');
    const authToken = params.get('auth_token');
    const state = params.get('state');
    
    console.log('Auth parameters:', { hasEmail: !!email, hasPassword: !!password, hasToken: !!authToken });
    
    // Log the state parameter for debugging
    console.log('State parameter received:', state);
    
    // If this is a first visit (no credentials), show the login form
    if (!email && !password && !authToken) {
      return c.html(loginForm(state || ''));
    }
    
    // Process email/password authentication
    if (email && password) {
      try {
        console.log('Processing login with email/password');
        
        // Call Xano login endpoint
        const loginResponse = await fetch(`${c.env.XANO_BASE_URL}/api:e6emygx3/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        if (!loginResponse.ok) {
          console.error('Xano login failed');
          return c.html(loginForm(state || '', 'Invalid email or password. Please try again.'));
        }
        
        // Extract user data with token
        const userData = await loginResponse.json();
        const token = userData.authToken || userData.api_key;
        
        if (!token) {
          console.error('No token in Xano response');
          return c.html(loginForm(state || '', 'Authentication succeeded but no token was returned.'));
        }
        
        console.log("Authentication successful, completing OAuth flow");

        // Prepare user data
        const userId = userData.id || 'xano_user';
        const label = userData.name || email || 'Xano User';
        const props = {
          apiKey: token,
          userId: userId,
          authenticated: true,
          userDetails: {
            name: userData.name || null,
            email: userData.email || email
          }
        };

        // Now complete the authorization with the enhanced request object
        // We need to copy exactly what the GitHub example does
        console.log("Starting OAuth completion with enhanced request object:", oauthReqInfo);

        try {
          // Log the exact request structure before authorization completion
          console.log("About to complete authorization with:", {
            clientId: oauthReqInfo.clientId,
            redirectUri: oauthReqInfo.redirectUri,
            responseType: oauthReqInfo.responseType,
            scope: oauthReqInfo.scope || [],
            hasToken: !!token,
            userId
          });

          // This is the critical part - the exact format matters for the token exchange
          const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
            request: oauthReqInfo,
            userId: userId,
            metadata: { label },
            // Include both in props AND as params for the token exchange
            scope: oauthReqInfo.scope || [],
            props: {
              // Include the token as accessToken just like GitHub example does
              accessToken: token,
              apiKey: token,
              userId: userId,
              authenticated: true,
              clientId: oauthReqInfo.clientId, // Explicitly include the client ID in props
              userDetails: {
                name: userData.name || null,
                email: userData.email || email
              }
            }
          });

          console.log("Authorization successfully completed with redirectTo:", redirectTo);

          // Redirect back to the client application
          return Response.redirect(redirectTo, 302);
        } catch (authError) {
          console.error("Error during authorization completion:", authError);
          throw authError;
        }
      } catch (error) {
        console.error('Error authenticating with Xano:', error);
        return c.html(loginForm(state || '', 'Server error during authentication. Please try again.'));
      }
    }
    
    // Process token authentication
    if (authToken) {
      try {
        console.log('Processing direct token authentication');
        
        // Verify token with Xano
        const response = await fetch(`${c.env.XANO_BASE_URL}/api:e6emygx3/auth/me`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
          console.error('Token validation failed');
          return c.html(loginForm(state || '', 'Invalid token. Please login with your credentials.'));
        }
        
        // Extract user data
        const userData = await response.json();
        
        console.log("Token authentication successful, completing OAuth flow");

        // Create auth data with proper user details
        const userId = userData.id || 'xano_user';
        const label = userData.name || userData.email || 'Xano User';
        const tokenToUse = userData.api_key || authToken;
        const props = {
          apiKey: tokenToUse,
          userId: userId,
          authenticated: true,
          userDetails: {
            name: userData.name || null,
            email: userData.email || null
          }
        };

        // Complete the authorization with the enhanced request object
        console.log("Starting OAuth completion with enhanced request object:", oauthReqInfo);

        try {
          // Log the exact request structure before authorization completion
          console.log("About to complete authorization with token auth:", {
            clientId: oauthReqInfo.clientId,
            redirectUri: oauthReqInfo.redirectUri,
            responseType: oauthReqInfo.responseType,
            scope: oauthReqInfo.scope || [],
            hasToken: !!tokenToUse,
            userId
          });

          // This is the critical part - the exact format matters for the token exchange
          const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
            request: oauthReqInfo,
            userId: userId,
            metadata: { label },
            // Include both in props AND as params for the token exchange
            scope: oauthReqInfo.scope || [],
            props: {
              // Include the token as accessToken just like GitHub example does
              accessToken: tokenToUse,
              apiKey: tokenToUse,
              userId: userId,
              authenticated: true,
              clientId: oauthReqInfo.clientId, // Explicitly include the client ID in props
              userDetails: {
                name: userData.name || null,
                email: userData.email || null
              }
            }
          });

          console.log("Authorization successfully completed with redirectTo:", redirectTo);

          // Redirect back to the client application
          return Response.redirect(redirectTo, 302);
        } catch (authError) {
          console.error("Error during authorization completion:", authError);
          throw authError;
        }
      } catch (error) {
        console.error('Error validating token:', error);
        return c.html(loginForm(state || '', 'Error validating token. Please login with your credentials.'));
      }
    }
    
    // Default case - show login form
    return c.html(loginForm(state || ''));
  } catch (error) {
    console.error('Error in /authorize endpoint:', error);
    return c.text('Server error during authorization', 500);
  }
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', server: 'Snappy MCP OAuth Server' });
});

// Handle token endpoint - explicit handler to fix client ID mismatch issues
app.post('/token', async (c) => {
  try {
    console.log('Token endpoint called directly');

    // Parse the token request form data
    const formData = await c.req.parseBody();
    console.log('Token request form data:', formData);

    // Extract grant type and code
    const grantType = formData.grant_type;
    const code = formData.code;
    const clientId = formData.client_id || "xXjCNLDsDV4VB2nG";

    console.log(`Processing token request: grant_type=${grantType}, code=${code?.substring(0, 10)}..., client_id=${clientId}`);

    // Let the OAuth provider handle the token exchange with the enhanced request
    return c.env.OAUTH_PROVIDER.fetch(c.req.raw);
  } catch (error) {
    console.error('Error in /token endpoint:', error);
    return c.json({ error: 'server_error', error_description: 'Internal server error' }, 500);
  }
});

// Class to handle fetch requests using the Hono app
export class XanoHandlerClass {
  async fetch(request: Request, env: any) {
    return app.fetch(request, env);
  }
}

// Export handler instance
export const XanoHandler = new XanoHandlerClass();