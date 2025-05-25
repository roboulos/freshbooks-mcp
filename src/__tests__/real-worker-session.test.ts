/**
 * TDD Tests for Real Worker Session ID Handling
 * 
 * These tests define the expected behavior for using the actual Worker session ID
 * from Durable Objects instead of generating fake timestamp-based IDs.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  getSessionInfoFromProps,
  registerWorkerSession,
  updateWorkerSessionActivity,
  logToolUsageWithRealSession,
  type SessionProps,
  type SessionInfo,
  type SessionRegistrationData,
  type SessionResult,
  type LogData,
  type LogResult
} from '../real-worker-session'

// Mock environment and dependencies
const mockEnv = {
  XANO_BASE_URL: 'https://xnwv-v1z6-dvnr.n7c.xano.io',
  OAUTH_KV: {
    get: vi.fn(),
    put: vi.fn(),
    list: vi.fn()
  }
}

// Mock fetch for API calls
global.fetch = vi.fn()

describe('Real Worker Session ID Handling (TDD)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSessionInfo() - Real Session ID Logic', () => {
    it('should return session info when props.sessionId is provided from Worker', () => {
      // EXPECTED BEHAVIOR: Use real Worker session ID when available
      const mockProps = {
        authenticated: true,
        userId: 'user-123',
        sessionId: 'worker-session-abc-def-ghi'  // Real Durable Object session ID
      }

      const result = getSessionInfoFromProps(mockProps)
      
      expect(result).toEqual({
        sessionId: 'worker-session-abc-def-ghi',
        userId: 'user-123'
      })
    })

    it('should return null when no real Worker session ID is available', () => {
      // EXPECTED BEHAVIOR: Never generate fake session IDs
      const mockProps = {
        authenticated: true,
        userId: 'user-123',
        // sessionId is missing - this should NOT generate a fake one
      }

      const result = getSessionInfoFromProps(mockProps)
      
      expect(result).toBeNull()
    })

    it('should return null when user is not authenticated', () => {
      const mockProps = {
        authenticated: false,
        userId: 'user-123',
        sessionId: 'worker-session-abc-def-ghi'
      }

      const result = getSessionInfoFromProps(mockProps)
      
      expect(result).toBeNull()
    })

    it('should return null when userId is missing', () => {
      const mockProps = {
        authenticated: true,
        sessionId: 'worker-session-abc-def-ghi'
        // userId is missing
      }

      const result = getSessionInfoFromProps(mockProps)
      
      expect(result).toBeNull()
    })
  })

  describe('Session Registration with Backend', () => {
    it('should register a new Worker session with backend on first use', async () => {
      // EXPECTED BEHAVIOR: Create mcp_sessions record using real Worker session ID
      const sessionData = {
        sessionId: 'worker-session-abc-def-ghi',
        userId: 'user-123',
        clientInfo: { platform: 'claude-code', version: '1.0' },
        ipAddress: '192.168.1.1'
      }

      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, session_id: sessionData.sessionId })
      } as Response)

      const result = await registerWorkerSession(sessionData, mockEnv)

      expect(result.success).toBe(true)
      expect(result.sessionId).toBe('worker-session-abc-def-ghi')
      
      // Verify correct API call
      expect(mockFetch).toHaveBeenCalledWith(
        'https://xnwv-v1z6-dvnr.n7c.xano.io/api:q3EJkKDR/mcp_sessions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: 'worker-session-abc-def-ghi',
            user_id: 'user-123',
            client_info: sessionData.clientInfo,
            status: 'active'
          })
        }
      )
    })

    it('should update existing Worker session activity', async () => {
      // EXPECTED BEHAVIOR: Update last_active timestamp for existing session
      const sessionId = 'worker-session-abc-def-ghi'
      
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response)

      const result = await updateWorkerSessionActivity(sessionId, mockEnv)

      expect(result.success).toBe(true)
      
      // Verify correct API call
      expect(mockFetch).toHaveBeenCalledWith(
        `https://xnwv-v1z6-dvnr.n7c.xano.io/api:q3EJkKDR/mcp_sessions/${sessionId}`,
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('last_active')
        })
      )
    })
  })

  describe('Session-Based Tool Logging', () => {
    it('should log tool usage with real Worker session ID', async () => {
      // EXPECTED BEHAVIOR: Log to usage_logs with real session ID, not fake ones
      const logData = {
        sessionId: 'worker-session-abc-def-ghi',
        userId: 'user-123',
        toolName: 'xano_list_instances',
        params: { instance_name: 'test' },
        result: { success: true },
        duration: 150
      }

      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1 })
      } as Response)

      await logToolUsageWithRealSession(logData, mockEnv)
      
      // Verify correct API call to usage_logs
      expect(mockFetch).toHaveBeenCalledWith(
        'https://xnwv-v1z6-dvnr.n7c.xano.io/api:q3EJkKDR/usage_logs',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('worker-session-abc-def-ghi')
        })
      )
    })

    it('should not log when no real Worker session ID is available', async () => {
      // EXPECTED BEHAVIOR: Refuse to log with fake session IDs
      const logData = {
        sessionId: null, // No real session ID
        userId: 'user-123',
        toolName: 'xano_list_instances'
      }

      const mockFetch = vi.mocked(fetch)

      const result = await logToolUsageWithRealSession(logData, mockEnv)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('No real Worker session ID')
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })
})

// Type definitions are now imported from the implementation file