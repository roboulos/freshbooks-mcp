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

// Interface for API request parameters
interface ApiParams {
  [key: string]: string | number | boolean | null | undefined;
}

// Interface for API request options
interface ApiRequestOptions {
  method: string;
  headers: Record<string, string>;
  body?: string;
}

/**
 * Utility function to make API requests
 * Handles token authentication, query parameters, and error responses
 */
export async function makeApiRequest(
  url: string,
  token: string,
  method = "GET",
  data: Record<string, any> | null = null,
  params: ApiParams | null = null
) {
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "Accept": "application/json"
  };

  try {
    const options: ApiRequestOptions = {
      method,
      headers
    };

    if (data && method !== "GET") {
      options.body = JSON.stringify(data);
    }

    // Add query parameters
    if (params) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
      url = `${url}?${queryParams.toString()}`;
    }

    const response = await fetch(url, options);

    if (response.status === 200) {
      return await response.json();
    } else {
      return {
        error: `API request failed with status ${response.status}`,
        details: await response.text()
      };
    }
  } catch (error: any) {
    console.error(`Exception during API request: ${error.message}`);
    return {
      error: `Exception during API request: ${error.message}`
    };
  }
}

/**
 * Utility function to get meta API URL for a Xano instance
 * Handles different formats of instance names and URLs
 */
export function getMetaApiUrl(instanceName: string): string {
  if (instanceName.startsWith("http://") || instanceName.startsWith("https://")) {
    return `${instanceName}/api:meta`;
  } else if (instanceName.includes(".") && !instanceName.includes("/")) {
    return `https://${instanceName}/api:meta`;
  } else {
    return `https://${instanceName}.n7c.xano.io/api:meta`;
  }
}

/**
 * Utility function to format ID values for API requests
 * Ensures consistent handling of string and numeric IDs
 */
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