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
    const url = `${base_url}/api:e6emygx3/auth/me`;
    console.log(`Calling auth/me at: ${url} with token prefix: ${token.substring(0, 10)}...`);
    
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch user info: ${response.status} ${response.statusText}`);
      let errorText = "";
      try {
        errorText = await response.text();
        console.error(`Error response body: ${errorText}`);
      } catch (e) {
        console.error("Could not read error response body");
      }
      return [null, new Response("Failed to fetch user info", { status: response.status })];
    }
    
    const userData = await response.json();
    console.log("Successfully fetched user info with keys:", Object.keys(userData));
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

// Utility function to make API requests with automatic refresh on 401
export async function makeApiRequest(url: string, token: string, method = "GET", data?: any, env?: any) {
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
    
    // Log the response status for debugging
    console.log(`API Response status for ${url}: ${response.status} ${response.statusText}`);
    
    // Handle 204 No Content responses (common for DELETE operations)
    if (response.status === 204) {
      return { success: true, message: "Operation completed successfully" };
    }
    
    // Handle success status codes for bulk operations that may not return content
    // Bulk create/update often returns 200 or 201 with empty body
    if (response.ok && url.includes('/bulk')) {
      // Try to read the text first to see if we actually got a response
      const text = await response.text();
      if (!text || text.trim() === '') {
        console.log("Received OK response with empty body for bulk operation");
        return { success: true, message: "Bulk operation completed successfully" };
      }
      
      // If we got text, try to parse it as JSON
      try {
        return JSON.parse(text);
      } catch (e) {
        console.log("Received OK response with non-JSON text for bulk operation:", text);
        return { success: true, message: "Bulk operation completed successfully", rawResponse: text };
      }
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
      // Handle 401 errors with automatic refresh
      if (response.status === 401 && env) {
        console.log("Got 401 Unauthorized - attempting automatic token refresh...");
        
        try {
          // Import refreshUserProfile dynamically to avoid circular imports
          const { refreshUserProfile } = await import('./refresh-profile');
          const refreshResult = await refreshUserProfile(env);
          
          if (refreshResult.success && refreshResult.profile?.apiKey) {
            console.log("Token refresh successful - retrying original request");
            
            // Retry the original request with fresh token
            const retryHeaders = {
              ...headers,
              "Authorization": `Bearer ${refreshResult.profile.apiKey}`
            };
            
            const retryOptions: RequestInit = {
              method,
              headers: retryHeaders,
            };
            
            if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
              retryOptions.body = JSON.stringify(data);
            }
            
            const retryResponse = await fetch(url, retryOptions);
            
            if (retryResponse.ok) {
              console.log("Retry request successful after token refresh");
              
              // Handle the successful retry response using the same logic as above
              if (retryResponse.status === 204) {
                return { success: true, message: "Operation completed successfully" };
              }
              
              if (url.includes('/bulk')) {
                const retryText = await retryResponse.text();
                if (!retryText || retryText.trim() === '') {
                  return { success: true, message: "Bulk operation completed successfully" };
                }
                try {
                  return JSON.parse(retryText);
                } catch (e) {
                  return { success: true, message: "Bulk operation completed successfully", rawResponse: retryText };
                }
              }
              
              const retryContentType = retryResponse.headers.get('content-type');
              if (!retryContentType || !retryContentType.includes('application/json')) {
                return { success: true, message: "Operation completed successfully" };
              }
              
              const retryText = await retryResponse.text();
              if (!retryText) {
                return { success: true, message: "Operation completed successfully" };
              }
              
              try {
                return JSON.parse(retryText);
              } catch (e) {
                return { success: true, rawResponse: retryText };
              }
            } else {
              console.log(`Retry request failed with status: ${retryResponse.status}`);
            }
          } else {
            console.log("Token refresh failed:", refreshResult.error);
          }
        } catch (refreshError) {
          console.error("Error during automatic token refresh:", refreshError);
        }
        
        // If refresh failed or retry failed, fall through to return the original 401 error
        console.log("Automatic refresh failed - returning 401 error");
      }
      
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
  // Import here to avoid circular dependency
  const { normalizeInstanceName } = require('./smart-error');
  
  // Normalize and validate instance name
  const normalizedInstance = normalizeInstanceName(instanceName);
  
  // If it's already a full URL, just append the API path
  if (normalizedInstance.startsWith("http://") || normalizedInstance.startsWith("https://")) {
    return `${normalizedInstance}/api:meta`;
  } 
  
  // Otherwise, it's a domain - ensure https and add API path
  const cleanInstance = normalizedInstance.replace(/\/$/, "");
  return `https://${cleanInstance}/api:meta`;
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