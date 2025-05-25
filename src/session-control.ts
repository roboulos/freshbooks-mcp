/**
 * Session Control Functionality
 * 
 * Implementation to pass TDD tests for session control and management.
 * Provides enable/disable, permissions, and monitoring capabilities.
 */

// Type definitions matching the TDD tests
export interface SessionControlResult {
  success: boolean
  sessionEnabled?: boolean
  error?: string
}

export interface PermissionsResult {
  success: boolean
  permissions?: any
  error?: string
}

export interface PermissionValidationResult {
  allowed: boolean
  reason?: string
}

export interface ActiveSessionsResult {
  success: boolean
  sessions?: any[]
  error?: string
}

export interface RevokeResult {
  success: boolean
  revokedCount?: number
  sessionIds?: string[]
  error?: string
}

export interface ExecutionCheckResult {
  canExecute: boolean
  reason?: string
}

/**
 * Disable a specific Worker session instantly
 */
export async function disableWorkerSession(
  sessionId: string, 
  env: any
): Promise<SessionControlResult> {
  try {
    const response = await fetch(`${env.XANO_BASE_URL}/api:q3EJkKDR/mcp_sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: false,
        status: 'disabled',
        updated_at: Date.now()
      })
    })

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: 'Session not found'
        }
      }
      const errorText = await response.text()
      return {
        success: false,
        error: `Failed to disable session: ${response.status} ${errorText}`
      }
    }

    return {
      success: true,
      sessionEnabled: false
    }
  } catch (error) {
    return {
      success: false,
      error: `Error disabling session: ${error.message}`
    }
  }
}

/**
 * Enable a previously disabled Worker session
 */
export async function enableWorkerSession(
  sessionId: string, 
  env: any
): Promise<SessionControlResult> {
  try {
    const response = await fetch(`${env.XANO_BASE_URL}/api:q3EJkKDR/mcp_sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        status: 'active',
        updated_at: Date.now()
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `Failed to enable session: ${response.status} ${errorText}`
      }
    }

    return {
      success: true,
      sessionEnabled: true
    }
  } catch (error) {
    return {
      success: false,
      error: `Error enabling session: ${error.message}`
    }
  }
}

/**
 * Set specific tool permissions for a Worker session
 */
export async function setSessionPermissions(
  sessionId: string, 
  permissions: any, 
  env: any
): Promise<PermissionsResult> {
  try {
    const response = await fetch(`${env.XANO_BASE_URL}/api:q3EJkKDR/mcp_sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        permissions: permissions,
        updated_at: Date.now()
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `Failed to set permissions: ${response.status} ${errorText}`
      }
    }

    return {
      success: true,
      permissions: permissions
    }
  } catch (error) {
    return {
      success: false,
      error: `Error setting permissions: ${error.message}`
    }
  }
}

/**
 * Validate session permissions before tool execution
 */
export async function validateSessionPermissions(
  sessionId: string, 
  toolName: string, 
  session: any
): Promise<PermissionValidationResult> {
  // Check if session is enabled
  if (!session.enabled) {
    return {
      allowed: false,
      reason: `Session ${sessionId} is disabled`
    }
  }

  // Check permissions if they exist
  if (session.permissions) {
    const { allowedTools, deniedTools } = session.permissions

    // Check denied tools first (takes precedence)
    if (deniedTools) {
      for (const deniedPattern of deniedTools) {
        if (matchesPattern(toolName, deniedPattern)) {
          return {
            allowed: false,
            reason: `Tool ${toolName} is denied by permissions`
          }
        }
      }
    }

    // Check allowed tools
    if (allowedTools) {
      let isAllowed = false
      for (const allowedPattern of allowedTools) {
        if (matchesPattern(toolName, allowedPattern)) {
          isAllowed = true
          break
        }
      }
      
      if (!isAllowed) {
        return {
          allowed: false,
          reason: `Tool ${toolName} is not in allowed tools list`
        }
      }
    }
  }

  return { allowed: true }
}

/**
 * Get all active Worker sessions
 */
export async function getActiveWorkerSessions(env: any): Promise<ActiveSessionsResult> {
  try {
    const response = await fetch(`${env.XANO_BASE_URL}/api:q3EJkKDR/mcp_sessions?status=active`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `Failed to get sessions: ${response.status} ${errorText}`
      }
    }

    const result = await response.json()
    return {
      success: true,
      sessions: result.sessions || []
    }
  } catch (error) {
    return {
      success: false,
      error: `Error getting sessions: ${error.message}`
    }
  }
}

/**
 * Revoke all sessions for a specific user
 */
export async function revokeAllUserSessions(
  userId: string, 
  env: any
): Promise<RevokeResult> {
  try {
    const response = await fetch(`${env.XANO_BASE_URL}/api:q3EJkKDR/sessions/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        revoke_all: true
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `Failed to revoke sessions: ${response.status} ${errorText}`
      }
    }

    const result = await response.json()
    return {
      success: true,
      revokedCount: result.revoked_sessions || 0,
      sessionIds: result.session_ids || []
    }
  } catch (error) {
    return {
      success: false,
      error: `Error revoking sessions: ${error.message}`
    }
  }
}

/**
 * Check session before tool execution
 */
export async function checkSessionBeforeToolExecution(
  sessionId: string, 
  toolName: string, 
  session: any
): Promise<ExecutionCheckResult> {
  // Check if session is enabled
  if (!session.enabled || session.status === 'disabled') {
    return {
      canExecute: false,
      reason: 'Session is disabled'
    }
  }

  // Validate permissions
  const permissionResult = await validateSessionPermissions(sessionId, toolName, session)
  if (!permissionResult.allowed) {
    return {
      canExecute: false,
      reason: permissionResult.reason
    }
  }

  return { canExecute: true }
}

/**
 * Helper function to match tool names against patterns
 */
function matchesPattern(toolName: string, pattern: string): boolean {
  // Convert glob-style pattern to regex
  const regexPattern = pattern
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  
  const regex = new RegExp(`^${regexPattern}$`, 'i')
  return regex.test(toolName)
}