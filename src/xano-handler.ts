import type { AuthRequest, OAuthHelpers } from '@cloudflare/workers-oauth-provider'
import { Hono } from 'hono'
import { fetchXanoAuthToken, fetchXanoUserInfo, Props } from './utils'
import { clientIdAlreadyApproved, parseRedirectApproval, renderApprovalDialog } from './workers-oauth-utils'
import { Env } from './index'

const app = new Hono<{ Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers } }>()

// Handler for /authorize GET - initial entry for OAuth flow
app.get('/authorize', async (c) => {
    // Parse the OAuth request from the client (exactly like GitHub example)
    const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw)
    
    // Extract and validate client ID (exactly like GitHub example)
    const { clientId } = oauthReqInfo
    if (!clientId) {
        return c.text('Invalid request', 400)
    }

    // Check if this client is already approved (exactly like GitHub example)
    // Note: You would need to set a COOKIE_ENCRYPTION_KEY environment variable
    if (c.env.COOKIE_ENCRYPTION_KEY && await clientIdAlreadyApproved(c.req.raw, oauthReqInfo.clientId, c.env.COOKIE_ENCRYPTION_KEY)) {
        return redirectToXanoLogin(c.req.raw, oauthReqInfo, c.env.XANO_BASE_URL)
    }

    // Show approval dialog (exactly like GitHub example)
    return renderApprovalDialog(c.req.raw, {
        client: await c.env.OAUTH_PROVIDER.lookupClient(clientId),
        server: {
            name: "Snappy MCP Server",
            logo: "https://xnwv-v1z6-dvnr.n7c.xano.io/vault/ze3RfzZ2/XmHFEalO-FuKgcZQCCuxtdniBvk/U3GjRA../snappy+logo.png",
            description: 'Connect your Xano instance to Claude with Snappy MCP - the easiest way to use Xano tools.', 
        },
        state: { oauthReqInfo }, // Pass OAuth request info through approval process
    })
})

// Handler for /authorize POST - processes approval form submission
app.post('/authorize', async (c) => {
    // Parse the approval form (exactly like GitHub example)
    try {
        // Process the form and get state and cookie headers
        const { state, headers } = await parseRedirectApproval(c.req.raw, c.env.COOKIE_ENCRYPTION_KEY || 'default-key')
        
        // Validate the state data
        if (!state.oauthReqInfo) {
            return c.text('Invalid request', 400)
        }

        // Redirect to Xano login with the OAuth request info
        return redirectToXanoLogin(c.req.raw, state.oauthReqInfo, c.env.XANO_BASE_URL, headers)
    } catch (error) {
        console.error("Error processing approval form:", error);
        return c.text('Error processing approval', 500);
    }
})

// Function to redirect to Xano login page (equivalent to GitHub's redirectToGithub function)
async function redirectToXanoLogin(request: Request, oauthReqInfo: AuthRequest, baseUrl: string, headers: Record<string, string> = {}) {
    // Create the login page URL
    const loginUrl = new URL('/login', request.url);
    
    // Pass the OAuth request info in state parameter
    const state = btoa(JSON.stringify(oauthReqInfo));
    loginUrl.searchParams.set('state', state);
    
    // Create the redirect response
    return new Response(null, {
        status: 302,
        headers: {
            ...headers,
            location: loginUrl.href,
        },
    })
}

// Xano login page
app.get('/login', async (c) => {
    try {
        // Get the state parameter from the URL
        const state = c.req.query('state');
        if (!state) {
            return c.text('Missing state parameter', 400);
        }
        
        // Render the login form HTML
        return new Response(renderLoginForm(state), {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
            },
        });
    } catch (error) {
        console.error("Error in login page:", error);
        return c.text('Error loading login page', 500);
    }
})

// Process login form submission
app.post('/login', async (c) => {
    try {
        // Parse the form data
        const formData = await c.req.parseBody();
        const email = formData.email as string;
        const password = formData.password as string;
        const state = formData.state as string;
        
        // Validate form data
        if (!email || !password || !state) {
            return c.text('Missing required form fields', 400);
        }
        
        // Authenticate with Xano
        const [token, errorResponse] = await fetchXanoAuthToken({
            base_url: c.env.XANO_BASE_URL,
            email,
            password,
        });
        
        // Handle authentication error
        if (errorResponse) {
            return new Response(renderLoginForm(state, 'Invalid email or password. Please try again.'), {
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                },
            });
        }
        
        // Redirect to callback with the token and state
        return Response.redirect(`${new URL('/callback', c.req.url).href}?token=${encodeURIComponent(token!)}&state=${encodeURIComponent(state)}`);
    } catch (error) {
        console.error("Error processing login form:", error);
        return c.text('Error processing login form', 500);
    }
})

// Direct token authentication handler
app.get('/token-auth', async (c) => {
    try {
        // Get token and state from query params
        const token = c.req.query('token');
        const state = c.req.query('state');
        
        if (!token || !state) {
            return c.text('Missing token or state parameter', 400);
        }
        
        // Redirect to callback with the token and state
        return Response.redirect(`${new URL('/callback', c.req.url).href}?token=${encodeURIComponent(token)}&state=${encodeURIComponent(state)}`);
    } catch (error) {
        console.error("Error in token auth:", error);
        return c.text('Error processing token authentication', 500);
    }
})

/**
 * OAuth Callback Endpoint
 *
 * This route handles the callback after Xano authentication.
 * It fetches user data, and completes the OAuth flow exactly like the GitHub example.
 */
app.get("/callback", async (c) => {
    try {
        // Get token and state from query parameters
        const token = c.req.query("token");
        const state = c.req.query("state");
        
        if (!token || !state) {
            return c.text("Missing token or state parameter", 400);
        }
        
        // Parse the original OAuth request info from state
        const oauthReqInfo = JSON.parse(atob(state)) as AuthRequest;
        if (!oauthReqInfo.clientId) {
            return c.text("Invalid state", 400);
        }
        
        // Fetch user info from Xano
        const [userData, errResponse] = await fetchXanoUserInfo({
            base_url: c.env.XANO_BASE_URL,
            token,
        });
        
        if (errResponse) {
            return errResponse;
        }
        
        // Extract user data
        const userId = userData.id || token.substring(0, 10);
        const name = userData.name || userData.email || 'Xano User';
        const email = userData.email;
        // Extract API key from auth/me response
        const apiKey = userData.api_key || null;  // Don't fall back to token!

        console.log("User data from /auth/me:", {
            hasApiKey: !!userData.api_key,
            apiKeyPrefix: userData.api_key ? userData.api_key.substring(0, 20) + '...' : null,
            userIdFromResponse: userData.id,
            email: userData.email,
            name: userData.name
        });
        
        console.log("Props being set in completeAuthorization:", {
            userId: userId,
            email: email,
            apiKeyPrefix: apiKey ? apiKey.substring(0, 20) + '...' : 'NO_API_KEY'
        });

        // Store the token explicitly in KV storage for our refresh mechanism
        await c.env.OAUTH_KV.put(
            `xano_auth_token:${userId}`,
            JSON.stringify({
                authToken: token,
                apiKey: apiKey,
                userId: userId,
                name: name,
                email: email,
                authenticated: true,
                lastUpdated: new Date().toISOString()
            }),
            { expirationTtl: 604800 } // 7 days
        );
        
        console.log(`Explicitly stored auth token in KV for user ${userId}`);
        
        // Calculate token TTL with environment variable control
        const configuredTTL = parseInt(c.env.OAUTH_TOKEN_TTL || "86400"); // 24 hours default
        const tokenTTL = Math.max(configuredTTL, 3600); // Minimum 1 hour
        
        console.log(`Setting OAuth token TTL to ${tokenTTL} seconds (${tokenTTL / 3600} hours)`);

        // Complete authorization exactly like GitHub example
        const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
            request: oauthReqInfo,
            userId,
            metadata: {
                label: name,
            },
            scope: oauthReqInfo.scope,
            // This will be available as this.props inside MyMCP
            props: {
                accessToken: token,
                name,
                email,
                apiKey: apiKey, // Use the API key from auth/me response
                freshbooksKey: userData.freshbooks_key || null, // FreshBooks key from user's Xano account
                userId: userId, // Explicitly set userId for hello tool
                authenticated: true,
            } as Props,
            accessTokenTTL: tokenTTL, // Enable automatic OAuth refresh when token expires
        });
        
        return Response.redirect(redirectTo);
    } catch (error) {
        console.error("Error in callback endpoint:", error);
        return c.text("Error completing authentication", 500);
    }
});

// Health check endpoint
app.get('/health', (c) => {
    return c.json({ status: 'ok', server: 'Snappy MCP Server' });
});

// Function to render the login form
function renderLoginForm(state: string, errorMessage?: string): string {
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
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
      padding: 35px;
      width: 100%;
      max-width: 440px;
      border: 1px solid #eaeaea;
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
      background-color: #FEDA31; /* Snappy yellow */
      color: black;
      border: 1px solid black;
      border-radius: 4px;
      padding: 12px 20px;
      font-size: 16px;
      width: 100%;
      cursor: pointer;
      transition: all 0.2s;
      font-weight: 500;
    }
    button:hover {
      background-color: #FFE55C;
      transform: translateY(-1px);
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
      max-width: 220px;
      margin-bottom: 20px;
    }
    .tagline {
      text-align: center;
      margin-bottom: 20px;
      color: #666;
      font-size: 16px;
      line-height: 1.4;
    }
    .xano-integration {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 20px 0;
      padding: 15px;
      background-color: #f5f5f5;
      border-radius: 8px;
    }
    .xano-integration img {
      height: 30px;
      margin-right: 10px;
    }
    .xano-integration span {
      font-size: 14px;
      color: #555;
    }
    .security-info {
      margin-bottom: 20px;
    }
    .security-box {
      display: flex;
      align-items: flex-start;
      background-color: #f5f5f5;
      border-radius: 8px;
      padding: 15px;
      margin: 20px 0;
    }
    .security-icon {
      flex-shrink: 0;
      margin-right: 15px;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .security-icon svg {
      color: #333;
    }
    .security-info p {
      font-size: 14px;
      color: #555;
      margin: 0;
      line-height: 1.5;
      text-align: left;
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
      <a href="https://mcp.snappy.ai" target="_blank">
        <img src="https://xnwv-v1z6-dvnr.n7c.xano.io/vault/ze3RfzZ2/XmHFEalO-FuKgcZQCCuxtdniBvk/U3GjRA../snappy+logo.png" alt="Snappy Logo">
      </a>
    </div>

    <div class="tagline">
      Sign in with your Snappy account to securely access your Xano tools
    </div>

    <div class="security-info">
      <div class="security-box">
        <div class="security-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <p>Snappy keeps your credentials and API keys secure. Your data stays protected while AI interacts with your apps.</p>
      </div>
    </div>

    <form action="/login" method="POST">
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
    
    <!-- API Token option removed as requested -->
  </div>
  
  <!-- JavaScript removed as token option was removed -->
</body>
</html>`;
}

// Class to handle fetch requests using the Hono app
export class XanoHandlerClass {
    async fetch(request: Request, env: any) {
        return app.fetch(request, env);
    }
}

// Export handler instance
export const XanoHandler = new XanoHandlerClass();

// Export the OAuth callback handler for testing
export async function handleOAuthCallback(context: { request: Request; env: any }) {
    try {
        // Get token and state from query parameters
        const url = new URL(context.request.url);
        const token = url.searchParams.get("token");
        const state = url.searchParams.get("state");
        
        if (!token || !state) {
            return new Response("Missing token or state parameter", { status: 400 });
        }
        
        // Parse the original OAuth request info from state
        const oauthReqInfo = JSON.parse(atob(state)) as AuthRequest;
        if (!oauthReqInfo.clientId) {
            return new Response("Invalid state", { status: 400 });
        }
        
        // Fetch user info from Xano
        const [userData, errResponse] = await fetchXanoUserInfo({
            base_url: context.env.XANO_BASE_URL,
            token,
        });
        
        if (errResponse) {
            return errResponse;
        }
        
        // Extract user data
        const userId = userData.id || token.substring(0, 10);
        const name = userData.name || userData.email || 'Xano User';
        const email = userData.email;
        // Extract API key from auth/me response
        const apiKey = userData.api_key || token;

        // Store the token explicitly in KV storage for our refresh mechanism
        await context.env.OAUTH_KV.put(
            `xano_auth_token:${userId}`,
            JSON.stringify({
                authToken: token,
                apiKey: apiKey,
                userId: userId,
                name: name,
                email: email,
                authenticated: true,
                lastRefreshed: new Date().toISOString()
            }),
            { expirationTtl: 604800 } // 7 days
        );
        
        // Calculate token TTL with environment variable control
        const configuredTTL = parseInt(context.env.OAUTH_TOKEN_TTL || "86400"); // 24 hours default
        const tokenTTL = Math.max(configuredTTL, 3600); // Minimum 1 hour

        // Complete authorization
        const { redirectTo } = await context.env.OAUTH_PROVIDER.completeAuthorization({
            request: oauthReqInfo,
            userId,
            metadata: {
                label: name,
            },
            scope: oauthReqInfo.scope,
            props: {
                accessToken: token,
                name,
                email,
                apiKey: apiKey,
                userId: userId,
                authenticated: true,
            } as Props,
            accessTokenTTL: tokenTTL,
        });
        
        return Response.redirect(redirectTo);
    } catch (error) {
        console.error("Error in OAuth callback:", error);
        return new Response("Error completing authentication", { status: 500 });
    }
}