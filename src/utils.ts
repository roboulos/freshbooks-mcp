// Helper function to extract token
export function extractToken(request) {
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
export async function makeApiRequest(url, token, method = "GET", data = null, params = null) {
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "Accept": "application/json"
  };
  
  try {
    const options = {
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
  } catch (error) {
    console.error(`Exception during API request: ${error.message}`);
    return {
      error: `Exception during API request: ${error.message}`
    };
  }
}

// Utility function to get meta API URL
export function getMetaApiUrl(instanceName) {
  if (instanceName.startsWith("http://") || instanceName.startsWith("https://")) {
    return `${instanceName}/api:meta`;
  } else if (instanceName.includes(".") && !instanceName.includes("/")) {
    return `https://${instanceName}/api:meta`;
  } else {
    return `https://${instanceName}.n7c.xano.io/api:meta`;
  }
}

// Utility function to format IDs
export function formatId(idValue) {
  if (idValue === null || idValue === undefined) {
    return null;
  }
  
  if (typeof idValue === 'string') {
    return idValue.trim().replace(/^["'](.*)["']$/, '$1');
  }
  
  return String(idValue);
}