/**
 * TDD Tests for Session Control Functionality
 * 
 * These tests define the expected behavior for controlling Worker sessions:
 * - Enable/disable specific sessions
 * - List active sessions  
 * - Set session permissions
 * - Revoke session access
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  disableWorkerSession,
  enableWorkerSession,
  setSessionPermissions,
  validateSessionPermissions,
  getActiveWorkerSessions,
  revokeAllUserSessions,
  checkSessionBeforeToolExecution,
  type SessionControlResult,
  type PermissionsResult,
  type PermissionValidationResult,
  type ActiveSessionsResult,
  type RevokeResult,
  type ExecutionCheckResult
} from '../session-control'

// Mock environment
const mockEnv = {
  XANO_BASE_URL: 'https://xnwv-v1z6-dvnr.n7c.xano.io'
}

// Mock fetch for API calls
global.fetch = vi.fn()

describe('Session Control Functionality (TDD)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Session Enable/Disable Control', () => {
    it('should disable a specific Worker session instantly', async () => {
      // EXPECTED BEHAVIOR: Disable session to prevent tool execution
      const sessionId = 'worker-session-abc-def-ghi'
      
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, session_id: sessionId, enabled: false })
      } as Response)

      const result = await disableWorkerSession(sessionId, mockEnv)

      expect(result.success).toBe(true)
      expect(result.sessionEnabled).toBe(false)
      
      // Verify correct API call
      expect(mockFetch).toHaveBeenCalledWith(
        `https://xnwv-v1z6-dvnr.n7c.xano.io/api:q3EJkKDR/mcp_sessions/${sessionId}`,
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('enabled')
        })
      )
    })

    it('should enable a previously disabled Worker session', async () => {
      // EXPECTED BEHAVIOR: Re-enable session to allow tool execution
      const sessionId = 'worker-session-abc-def-ghi'
      
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, session_id: sessionId, enabled: true })
      } as Response)

      const result = await enableWorkerSession(sessionId, mockEnv)

      expect(result.success).toBe(true)
      expect(result.sessionEnabled).toBe(true)
      
      // Verify correct API call
      expect(mockFetch).toHaveBeenCalledWith(
        `https://xnwv-v1z6-dvnr.n7c.xano.io/api:q3EJkKDR/mcp_sessions/${sessionId}`,
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('enabled')
        })
      )
    })

    it('should handle session not found when disabling', async () => {
      const sessionId = 'nonexistent-session'
      
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Session not found'
      } as Response)

      const result = await disableWorkerSession(sessionId, mockEnv)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Session not found')
    })
  })

  describe('Session Permission Control', () => {
    it('should set specific tool permissions for a Worker session', async () => {
      // EXPECTED BEHAVIOR: Limit which tools a session can use
      const sessionId = 'worker-session-abc-def-ghi'
      const permissions = {
        allowedTools: ['xano_list_instances', 'xano_get_instance_details'],
        deniedTools: ['xano_delete_*'],
        rateLimit: 100, // calls per hour
        ipRestrictions: ['192.168.1.0/24']
      }
      
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, permissions })
      } as Response)

      const result = await setSessionPermissions(sessionId, permissions, mockEnv)

      expect(result.success).toBe(true)
      expect(result.permissions).toEqual(permissions)
      
      // Verify correct API call
      expect(mockFetch).toHaveBeenCalledWith(
        `https://xnwv-v1z6-dvnr.n7c.xano.io/api:q3EJkKDR/mcp_sessions/${sessionId}`,
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('permissions')
        })
      )
    })

    it('should validate session permissions before tool execution', async () => {
      // EXPECTED BEHAVIOR: Check permissions before allowing tool calls
      const sessionId = 'worker-session-abc-def-ghi'
      const toolName = 'xano_delete_table'
      
      const mockSession = {
        enabled: true,
        permissions: {
          allowedTools: ['xano_list_*', 'xano_get_*'],
          deniedTools: ['xano_delete_*'],
          rateLimit: 100
        }
      }

      const result = await validateSessionPermissions(sessionId, toolName, mockSession)

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Tool xano_delete_table is denied by permissions')
    })

    it('should allow tool execution when permissions match', async () => {
      const sessionId = 'worker-session-abc-def-ghi'
      const toolName = 'xano_list_instances'
      
      const mockSession = {
        enabled: true,
        permissions: {
          allowedTools: ['xano_list_*', 'xano_get_*'],
          deniedTools: ['xano_delete_*'],
          rateLimit: 100
        }
      }

      const result = await validateSessionPermissions(sessionId, toolName, mockSession)

      expect(result.allowed).toBe(true)
      expect(result.reason).toBeUndefined()
    })
  })

  describe('Active Session Management', () => {
    it('should list all active Worker sessions', async () => {
      // EXPECTED BEHAVIOR: Get real-time view of all active sessions
      const mockSessions = [
        {
          session_id: 'worker-session-abc-def-ghi',
          user_id: 'user-123',
          last_active: Date.now(),
          status: 'active',
          enabled: true,
          tool_call_count: 15,
          last_tool_called: 'xano_list_instances'
        },
        {
          session_id: 'worker-session-xyz-uvw-rst',
          user_id: 'user-456',
          last_active: Date.now() - 300000, // 5 minutes ago
          status: 'active',
          enabled: true,
          tool_call_count: 8,
          last_tool_called: 'xano_get_table_details'
        }
      ]
      
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: mockSessions })
      } as Response)

      const result = await getActiveWorkerSessions(mockEnv)

      expect(result.success).toBe(true)
      expect(result.sessions).toHaveLength(2)
      expect(result.sessions[0].session_id).toBe('worker-session-abc-def-ghi')
      expect(result.sessions[1].session_id).toBe('worker-session-xyz-uvw-rst')
      
      // Verify correct API call
      expect(mockFetch).toHaveBeenCalledWith(
        'https://xnwv-v1z6-dvnr.n7c.xano.io/api:q3EJkKDR/mcp_sessions?status=active',
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
      )
    })

    it('should revoke all sessions for a specific user', async () => {
      // EXPECTED BEHAVIOR: Disable all sessions for a user (like revoking API key)
      const userId = 'user-123'
      const affectedSessions = ['worker-session-abc', 'worker-session-def']
      
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          success: true, 
          revoked_sessions: affectedSessions.length,
          session_ids: affectedSessions
        })
      } as Response)

      const result = await revokeAllUserSessions(userId, mockEnv)

      expect(result.success).toBe(true)
      expect(result.revokedCount).toBe(2)
      expect(result.sessionIds).toEqual(affectedSessions)
      
      // Verify correct API call
      expect(mockFetch).toHaveBeenCalledWith(
        'https://xnwv-v1z6-dvnr.n7c.xano.io/api:q3EJkKDR/sessions/revoke',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            revoke_all: true
          })
        }
      )
    })
  })

  describe('Session Control Integration', () => {
    it('should prevent tool execution when session is disabled', async () => {
      // EXPECTED BEHAVIOR: Tool wrapper should check session status before execution
      const sessionId = 'worker-session-abc-def-ghi'
      const toolName = 'xano_list_instances'
      
      const mockSession = {
        enabled: false,
        status: 'disabled'
      }

      const result = await checkSessionBeforeToolExecution(sessionId, toolName, mockSession)

      expect(result.canExecute).toBe(false)
      expect(result.reason).toContain('Session is disabled')
    })

    it('should allow tool execution when session is enabled and has permissions', async () => {
      const sessionId = 'worker-session-abc-def-ghi'
      const toolName = 'xano_list_instances'
      
      const mockSession = {
        enabled: true,
        status: 'active',
        permissions: {
          allowedTools: ['xano_*'],
          rateLimit: 100
        }
      }

      const result = await checkSessionBeforeToolExecution(sessionId, toolName, mockSession)

      expect(result.canExecute).toBe(true)
      expect(result.reason).toBeUndefined()
    })
  })
})

// Type definitions are now imported from the implementation file