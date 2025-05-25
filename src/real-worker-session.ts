/**
 * Real Worker Session ID Management
 * 
 * Implementation to pass TDD tests for real Worker session ID handling.
 * Uses actual Durable Object session IDs instead of generating fake ones.
 */

// Type definitions matching the TDD tests
export interface SessionProps {
  authenticated?: boolean
  userId?: string
  sessionId?: string
  apiKey?: string
}

export interface SessionInfo {
  sessionId: string
  userId: string
}

export interface SessionRegistrationData {
  sessionId: string
  userId: string
  clientInfo?: any
  ipAddress?: string
}

export interface SessionResult {
  success: boolean
  sessionId?: string
  error?: string
}

export interface LogData {
  sessionId: string | null
  userId: string
  toolName: string
  params?: any
  result?: any
  duration?: number
}

export interface LogResult {
  success: boolean
  error?: string
}

/**
 * Retrieve session info from KV storage using API key
 * This is the primary method since KV storage persists through Worker hibernation
 */
export async function getSessionInfoFromKV(apiKey: string, env: any): Promise<SessionInfo | null> {
  try {
    // Look up session mapping using apikey:${apiKey} pattern
    const kvKey = `apikey:${apiKey}`;
    const storedData = await env.SESSION_CACHE.get(kvKey);
    
    if (!storedData) {
      console.log(`No session data found in KV for API key: ${apiKey}`);
      return null;
    }
    
    // Parse stored session data
    const sessionData = JSON.parse(storedData);
    
    if (!sessionData.sessionId || !sessionData.userId) {
      console.warn('Invalid session data structure in KV:', sessionData);
      return null;
    }
    
    return {
      sessionId: sessionData.sessionId,
      userId: sessionData.userId
    };
  } catch (error) {
    console.warn('Failed to retrieve session from KV storage:', error.message);
    return null;
  }
}

/**
 * Get session info with KV storage as primary source and URL as fallback
 * This is the recommended approach for production use
 */
export async function getSessionInfoWithKVFallback(
  props: SessionProps, 
  request: Request, 
  env: any
): Promise<SessionInfo | null> {
  // Must be authenticated and have userId
  if (!props?.authenticated || !props?.userId) {
    return null;
  }
  
  // Priority 1: Use props.sessionId if available (direct Durable Object session ID)
  if (props.sessionId) {
    return {
      sessionId: props.sessionId,
      userId: props.userId
    };
  }
  
  // Priority 2: Look up from KV storage using API key
  if (props.apiKey) {
    const kvSessionInfo = await getSessionInfoFromKV(props.apiKey, env);
    if (kvSessionInfo) {
      console.log(`Retrieved session from KV: ${kvSessionInfo.sessionId}`);
      return kvSessionInfo;
    }
  }
  
  // Priority 3: Fallback to URL sessionId
  const urlSessionId = extractSessionIdFromRequest(request);
  if (urlSessionId) {
    console.log(`Using session from URL fallback: ${urlSessionId}`);
    return {
      sessionId: urlSessionId,
      userId: props.userId
    };
  }
  
  // No session ID available anywhere - refuse to generate fake one
  console.error("No real Worker session ID available from KV, URL, or props - refusing to generate fake ID");
  return null;
}

/**
 * Extract session ID from HTTP request URL parameters
 */
export function extractSessionIdFromRequest(request: Request): string | null {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    return sessionId || null;
  } catch (error) {
    console.warn('Failed to extract session ID from request URL:', error.message);
    return null;
  }
}

/**
 * Get session info with fallback from props to URL
 * Prioritizes props.sessionId over URL sessionId
 */
export function getSessionInfoWithFallback(props: SessionProps, request: Request): SessionInfo | null {
  // Must be authenticated and have userId
  if (!props?.authenticated || !props?.userId) {
    return null;
  }
  
  // Priority 1: Use props.sessionId if available (real Durable Object session ID)
  if (props.sessionId) {
    return {
      sessionId: props.sessionId,
      userId: props.userId
    };
  }
  
  // Priority 2: Fallback to URL sessionId
  const urlSessionId = extractSessionIdFromRequest(request);
  if (urlSessionId) {
    return {
      sessionId: urlSessionId,
      userId: props.userId
    };
  }
  
  // No session ID available anywhere - refuse to generate fake one
  console.error("No real Worker session ID available - refusing to generate fake ID");
  return null;
}

/**
 * Extract session info from Worker props using real session ID only
 * Never generates fake session IDs - this is the core TDD requirement
 */
export function getSessionInfoFromProps(props: SessionProps): SessionInfo | null {
  // Must be authenticated and have userId
  if (!props?.authenticated || !props?.userId) {
    return null
  }
  
  // CRITICAL: Only use real Worker session ID, never generate fake ones
  if (!props.sessionId) {
    console.error("No real Worker session ID available - refusing to generate fake ID")
    return null
  }
  
  return {
    sessionId: props.sessionId,  // Real Durable Object session ID
    userId: props.userId
  }
}

/**
 * Register a new Worker session with backend
 */
export async function registerWorkerSession(
  data: SessionRegistrationData, 
  env: any
): Promise<SessionResult> {
  try {
    const response = await fetch(`${env.XANO_BASE_URL}/api:q3EJkKDR/mcp_sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: data.sessionId,
        user_id: data.userId,
        client_info: data.clientInfo || {},
        status: 'active'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `Failed to register session: ${response.status} ${errorText}`
      }
    }

    const result = await response.json()
    return {
      success: true,
      sessionId: data.sessionId
    }
  } catch (error) {
    return {
      success: false,
      error: `Error registering session: ${error.message}`
    }
  }
}

/**
 * Update existing Worker session activity
 */
export async function updateWorkerSessionActivity(
  sessionId: string, 
  env: any
): Promise<SessionResult> {
  try {
    const response = await fetch(`${env.XANO_BASE_URL}/api:q3EJkKDR/mcp_sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        last_active: Date.now(),
        status: 'active'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `Failed to update session: ${response.status} ${errorText}`
      }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: `Error updating session: ${error.message}`
    }
  }
}

/**
 * Log tool usage with real Worker session ID only
 * Refuses to log if no real session ID is available
 */
export async function logToolUsageWithRealSession(
  data: LogData, 
  env: any
): Promise<LogResult> {
  // CRITICAL: Refuse to log without real Worker session ID
  if (!data.sessionId) {
    return {
      success: false,
      error: "No real Worker session ID available - refusing to log with fake ID"
    }
  }

  try {
    const response = await fetch(`${env.XANO_BASE_URL}/api:q3EJkKDR/usage_logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: data.sessionId,
        user_id: data.userId,
        tool_name: data.toolName,
        params: data.params || {},
        result: data.result || {},
        error: '',
        duration: data.duration || 0,
        timestamp: Date.now(),
        ip_address: '',
        ai_model: 'claude-3.5-sonnet',
        cost: 0
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return { success: true }
  } catch (error) {
    // Log error but don't throw - fire and forget pattern
    console.warn('Usage logging failed:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}