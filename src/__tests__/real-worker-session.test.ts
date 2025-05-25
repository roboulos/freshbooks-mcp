/**
 * TDD Tests for Real Worker Session ID Handling
 * 
 * These tests define the expected behavior for using the actual Worker session ID
 * from Durable Objects instead of generating fake timestamp-based IDs.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  getSessionInfoFromProps,
  extractSessionIdFromRequest,
  getSessionInfoWithFallback,
  getSessionInfoFromKV,
  getSessionInfoWithKVFallback,
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
  },
  SESSION_CACHE: {
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

    it('should extract session ID from URL when props.sessionId is missing', () => {
      // EXPECTED BEHAVIOR: Extract sessionId from URL parameter when props.sessionId is undefined
      const mockRequest = new Request('https://example.com/sse/message?sessionId=url-session-xyz-123')
      
      const result = extractSessionIdFromRequest(mockRequest)
      
      expect(result).toBe('url-session-xyz-123')
    })

    it('should return null when no session ID in URL or props', () => {
      // EXPECTED BEHAVIOR: Return null when no session ID available anywhere
      const mockRequest = new Request('https://example.com/sse/message')
      
      const result = extractSessionIdFromRequest(mockRequest)
      
      expect(result).toBeNull()
    })

    it('should prioritize props.sessionId over URL sessionId', () => {
      // EXPECTED BEHAVIOR: Props sessionId takes precedence over URL sessionId
      const mockProps = {
        authenticated: true,
        userId: 'user-123',
        sessionId: 'props-session-priority'
      }
      const mockRequest = new Request('https://example.com/sse/message?sessionId=url-session-secondary')
      
      const result = getSessionInfoWithFallback(mockProps, mockRequest)
      
      expect(result).toEqual({
        sessionId: 'props-session-priority',
        userId: 'user-123'
      })
    })

    it('should fallback to URL sessionId when props.sessionId is missing', () => {
      // EXPECTED BEHAVIOR: Use URL sessionId when props.sessionId is undefined
      const mockProps = {
        authenticated: true,
        userId: 'user-123'
        // sessionId missing from props
      }
      const mockRequest = new Request('https://example.com/sse/message?sessionId=url-fallback-session')
      
      const result = getSessionInfoWithFallback(mockProps, mockRequest)
      
      expect(result).toEqual({
        sessionId: 'url-fallback-session',
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

  describe('Session ID Retrieval from KV Storage', () => {
    it('should retrieve session info from SESSION_CACHE using API key', async () => {
      // EXPECTED BEHAVIOR: Look up sessionId from SESSION_CACHE using apiKey pattern
      const mockApiKey = 'api-key-12345'
      const mockSessionData = JSON.stringify({
        sessionId: 'kv-stored-session-abc-123',
        userId: 'user-456'
      })
      
      const mockSessionCache = vi.mocked(mockEnv.SESSION_CACHE.get)
      mockSessionCache.mockResolvedValueOnce(mockSessionData)
      
      const result = await getSessionInfoFromKV(mockApiKey, mockEnv)
      
      expect(result).toEqual({
        sessionId: 'kv-stored-session-abc-123',
        userId: 'user-456'
      })
      expect(mockSessionCache).toHaveBeenCalledWith(`apikey:${mockApiKey}`)
    })

    it('should return null when SESSION_CACHE has no data for API key', async () => {
      // EXPECTED BEHAVIOR: Return null when no session mapping exists
      const mockApiKey = 'unknown-api-key'
      
      const mockSessionCache = vi.mocked(mockEnv.SESSION_CACHE.get)
      mockSessionCache.mockResolvedValueOnce(null)
      
      const result = await getSessionInfoFromKV(mockApiKey, mockEnv)
      
      expect(result).toBeNull()
      expect(mockSessionCache).toHaveBeenCalledWith(`apikey:${mockApiKey}`)
    })

    it('should handle malformed JSON in SESSION_CACHE gracefully', async () => {
      // EXPECTED BEHAVIOR: Return null when stored data is corrupted
      const mockApiKey = 'api-key-with-bad-data'
      
      const mockSessionCache = vi.mocked(mockEnv.SESSION_CACHE.get)
      mockSessionCache.mockResolvedValueOnce('invalid-json-data')
      
      const result = await getSessionInfoFromKV(mockApiKey, mockEnv)
      
      expect(result).toBeNull()
    })

    it('should use KV storage as primary source with URL fallback', async () => {
      // EXPECTED BEHAVIOR: Prioritize KV storage over URL, fallback to URL if KV fails
      const mockApiKey = 'api-key-primary'
      const mockProps = {
        authenticated: true,
        userId: 'user-123',
        apiKey: mockApiKey
        // No sessionId in props
      }
      const mockRequest = new Request('https://example.com/sse/message?sessionId=url-backup-session')
      
      const mockSessionData = JSON.stringify({
        sessionId: 'kv-primary-session-xyz',
        userId: 'user-123'
      })
      
      const mockSessionCache = vi.mocked(mockEnv.SESSION_CACHE.get)
      mockSessionCache.mockResolvedValueOnce(mockSessionData)
      
      const result = await getSessionInfoWithKVFallback(mockProps, mockRequest, mockEnv)
      
      expect(result).toEqual({
        sessionId: 'kv-primary-session-xyz',
        userId: 'user-123'
      })
      expect(mockSessionCache).toHaveBeenCalledWith(`apikey:${mockApiKey}`)
    })

    it('should fallback to URL when KV storage has no session data', async () => {
      // EXPECTED BEHAVIOR: Use URL sessionId when KV storage is empty
      const mockApiKey = 'api-key-no-kv-data'
      const mockProps = {
        authenticated: true,
        userId: 'user-123',
        apiKey: mockApiKey
      }
      const mockRequest = new Request('https://example.com/sse/message?sessionId=url-fallback-session')
      
      const mockSessionCache = vi.mocked(mockEnv.SESSION_CACHE.get)
      mockSessionCache.mockResolvedValueOnce(null) // No KV data
      
      const result = await getSessionInfoWithKVFallback(mockProps, mockRequest, mockEnv)
      
      expect(result).toEqual({
        sessionId: 'url-fallback-session',
        userId: 'user-123'
      })
    })

    it('should return null when neither KV nor URL have session ID', async () => {
      // EXPECTED BEHAVIOR: Return null when all retrieval methods fail
      const mockApiKey = 'api-key-no-session-anywhere'
      const mockProps = {
        authenticated: true,
        userId: 'user-123',
        apiKey: mockApiKey
      }
      const mockRequest = new Request('https://example.com/sse/message') // No sessionId in URL
      
      const mockSessionCache = vi.mocked(mockEnv.SESSION_CACHE.get)
      mockSessionCache.mockResolvedValueOnce(null) // No KV data
      
      const result = await getSessionInfoWithKVFallback(mockProps, mockRequest, mockEnv)
      
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