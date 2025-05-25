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