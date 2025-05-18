/**
 * Fetches an authentication token from Xano.
 *
 * @param {Object} options
 * @param {string} options.base_url - The Xano base URL.
 * @param {string} options.email - The user's email.
 * @param {string} options.password - The user's password.
 *
 * @returns {Promise<[string, null] | [null, Response]>} A promise that resolves to an array containing the access token or an error response.
 */
export async function fetchXanoAuthToken({
  base_url,
  email,
  password,
}: {
  base_url: string;
  email: string;
  password: string;
}): Promise<[string, null] | [null, Response]> {
  if (!email || !password) {
    return [null, new Response("Missing credentials", { status: 400 })];
  }

  try {
    const response = await fetch(`${base_url}/api:e6emygx3/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      console.error("Xano login failed");
      return [null, new Response("Authentication failed", { status: 401 })];
    }
    
    const userData = await response.json();
    const token = userData.authToken || userData.api_key;
    
    if (!token) {
      return [null, new Response("Missing token in response", { status: 400 })];
    }
    
    return [token, null];
  } catch (error) {
    console.error("Error fetching Xano token:", error);
    return [null, new Response("Server error during authentication", { status: 500 })];
  }
}

/**
 * Fetches user info from Xano using an access token.
 *
 * @param {Object} options
 * @param {string} options.base_url - The Xano base URL.
 * @param {string} options.token - The authentication token.
 *
 * @returns {Promise<[any, null] | [null, Response]>} A promise that resolves to an array containing the user data or an error response.
 */
export async function fetchXanoUserInfo({
  base_url,
  token,
}: {
  base_url: string;
  token: string;
}): Promise<[any, null] | [null, Response]> {
  if (!token) {
    return [null, new Response("Missing token", { status: 400 })];
  }

  try {
    const response = await fetch(`${base_url}/api:e6emygx3/auth/me`, {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      console.error("Failed to fetch user info");
      return [null, new Response("Failed to fetch user info", { status: response.status })];
    }
    
    const userData = await response.json();
    return [userData, null];
  } catch (error) {
    console.error("Error fetching user info:", error);
    return [null, new Response("Server error fetching user info", { status: 500 })];
  }
}

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
export type Props = {
  accessToken: string;
  name: string | null;
  email: string | null;
  apiKey: string;  // The API key from auth/me response
  userId: string;  // User ID from auth/me response
  authenticated: boolean;
};

/**
 * Helper function to extract token from a request
 * Tries both URL parameters and Authorization header
 */
export function extractToken(request: Request): string | null {
  // Check URL parameters
  const url = new URL(request.url);
  const urlToken = url.searchParams.get('auth_token');
  if (urlToken) return urlToken;

  // Check Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

// Utility function to make API requests
export async function makeApiRequest(url: string, token: string, method = "GET", data?: any) {
  try {
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    
    const options: RequestInit = {
      method,
      headers,
    };
    
    if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    
    // Handle 204 No Content responses (common for DELETE operations)
    if (response.status === 204) {
      return { success: true, message: "Operation completed successfully" };
    }
    
    // If not a JSON response, handle differently
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      if (!response.ok) {
        return { error: `HTTP Error: ${response.status} ${response.statusText}` };
      }
      return { success: true, message: "Operation completed successfully" };
    }
    
    // For JSON responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        error: errorData.message || `HTTP Error: ${response.status} ${response.statusText}`,
        code: errorData.code,
        status: response.status
      };
    }
    
    // Handle empty responses that should be JSON
    const text = await response.text();
    if (!text) {
      return { success: true, message: "Operation completed successfully" };
    }
    
    // Parse JSON response
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse JSON:", text);
      return { success: true, rawResponse: text };
    }
  } catch (error) {
    console.error(`API request error: ${error.message}`);
    return { error: error.message };
  }
}

// Utility to get meta API URL for an instance
export function getMetaApiUrl(instanceName: string): string {
  if (instanceName.startsWith("http://") || instanceName.startsWith("https://")) {
    return `${instanceName}/api:meta`;
  } else if (instanceName.includes(".") && !instanceName.includes("/")) {
    return `https://${instanceName}/api:meta`;
  } else {
    return `https://${instanceName}.n7c.xano.io/api:meta`;
  }
}

// Format ID for Xano API (accept string or number)
export function formatId(idValue: string | number | null | undefined): string | null {
  if (idValue === null || idValue === undefined) {
    return null;
  }

  if (typeof idValue === 'string') {
    return idValue.trim().replace(/^["'](.*)["']$/, '$1');
  }

  return String(idValue);
}

/**
 * Get the time in ISO format without milliseconds
 * Useful for logging and token expiration times
 */
export function getIsoTime(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, 'Z');
}

/**
 * Generate a random ID (useful for tokens, etc)
 */
export function generateId(length = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars.charAt(randomValues[i] % chars.length);
  }
  return result;
}