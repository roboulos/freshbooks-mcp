import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAuthService, type AuthService, type XanoUser, type MCPSession, type UsageLog } from '../auth-service'

describe('Authentication Integration with Xano', () => {
  let authService: AuthService
  let mockFetch: any

  beforeEach(() => {
    // Reset mocks
    mockFetch = vi.fn()
    global.fetch = mockFetch
    
    // Create actual auth service implementation
    authService = createAuthService()
  })

  describe('API Key Validation', () => {
    it('should validate API key against Xano users table', async () => {
      // Arrange
      const apiKey = 'test-api-key-123'
      const mockUser: XanoUser = {
        id: 'user-123',
        email: 'test@example.com', 
        name: 'Test User',
        api_key: apiKey,
        subscription_tier: 'pro',
        status: 'active',
        last_login: '2025-01-01T00:00:00Z'
      }

      // Mock Xano auth/me endpoint response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ self: mockUser })
      })

      // Act
      const result = await authService.validateApiKey(apiKey)

      // Assert
      expect(result.valid).toBe(true)
      expect(result.user).toEqual(mockUser)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://xnwv-v1z6-dvnr.n7c.xano.io/api:e6emygx3/auth/me',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${apiKey}`
          })
        })
      )
    })

    it('should reject invalid API key', async () => {
      // Arrange
      const invalidApiKey = 'invalid-key'
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' })
      })

      // Act
      const result = await authService.validateApiKey(invalidApiKey)

      // Assert
      expect(result.valid).toBe(false)
      expect(result.user).toBeUndefined()
    })

    it('should handle network errors gracefully', async () => {
      // Arrange
      const apiKey = 'test-key'
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      // Act
      const result = await authService.validateApiKey(apiKey)

      // Assert
      expect(result.valid).toBe(false)
      expect(result.user).toBeUndefined()
    })
  })

  describe('Session Management', () => {
    it('should create new MCP session when valid user connects', async () => {
      // Arrange
      const userId = 'user-123'
      const clientInfo = {
        userAgent: 'Claude-MCP/1.0',
        ipAddress: '192.168.1.1',
        timestamp: '2025-01-01T00:00:00Z'
      }
      
      const expectedSession: MCPSession = {
        id: 1,
        session_id: 'session-abc-123',
        user_id: userId,
        client_info: clientInfo,
        last_active: '2025-01-01T00:00:00Z',
        status: 'active'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(expectedSession)
      })

      // Act
      const session = await authService.createSession(userId, clientInfo)

      // Assert
      expect(session).toEqual(expectedSession)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/mcp_sessions'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(userId)
        })
      )
    })

    it('should update session activity timestamp', async () => {
      // Arrange
      const sessionId = 'session-abc-123'
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })

      // Act
      await authService.updateSessionActivity(sessionId)

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        `https://xnwv-v1z6-dvnr.n7c.xano.io/api:e6emygx3/mcp_sessions/${sessionId}`,
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('active')
        })
      )
    })

    it('should validate existing session', async () => {
      // Arrange
      const sessionId = 'session-abc-123'
      const validSession: MCPSession = {
        id: 1,
        session_id: sessionId,
        user_id: 'user-123',
        client_info: {},
        last_active: new Date().toISOString(), // Use current time so it's not expired
        status: 'active'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(validSession)
      })

      // Act
      const result = await authService.validateSession(sessionId)

      // Assert
      expect(result.valid).toBe(true)
      expect(result.session).toEqual(validSession)
    })

    it('should reject expired sessions', async () => {
      // Arrange
      const sessionId = 'expired-session'
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Session not found' })
      })

      // Act
      const result = await authService.validateSession(sessionId)

      // Assert
      expect(result.valid).toBe(false)
      expect(result.session).toBeUndefined()
    })
  })

  describe('Usage Logging', () => {
    it('should log successful MCP tool usage', async () => {
      // Arrange
      const usageData: Partial<UsageLog> = {
        session_id: 'session-abc-123',
        user_id: 'user-123',
        function_id: 1,
        input_params: { instance_name: 'test-instance' },
        output_result: { success: true, data: [] },
        http_status: 200,
        response_time_ms: 150,
        ai_model: 'claude-3-sonnet',
        ip_address: '192.168.1.1',
        cost: 0.001
      }

      const expectedLog: UsageLog = {
        id: 1,
        ...usageData
      } as UsageLog

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(expectedLog)
      })

      // Act
      const log = await authService.logUsage(usageData)

      // Assert
      expect(log).toEqual(expectedLog)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/usage_logs'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('session-abc-123')
        })
      )
    })

    it('should log failed MCP tool usage with error details', async () => {
      // Arrange
      const errorUsageData: Partial<UsageLog> = {
        session_id: 'session-abc-123',
        user_id: 'user-123',
        function_id: 1,
        input_params: { invalid: 'params' },
        http_status: 400,
        response_time_ms: 50,
        error_message: 'Invalid parameters provided',
        cost: 0
      }

      const expectedLog: UsageLog = {
        id: 2,
        ...errorUsageData
      } as UsageLog

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(expectedLog)
      })

      // Act
      const log = await authService.logUsage(errorUsageData)

      // Assert
      expect(log.error_message).toBe('Invalid parameters provided')
      expect(log.http_status).toBe(400)
      expect(log.cost).toBe(0)
    })
  })

  describe('End-to-End Authentication Flow', () => {
    it('should handle complete MCP connection lifecycle', async () => {
      // Arrange
      const apiKey = 'valid-api-key'
      const mockUser: XanoUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User', 
        api_key: apiKey,
        subscription_tier: 'pro',
        status: 'active',
        last_login: null
      }

      // Mock sequence: auth validation -> session creation -> tool usage -> logging
      mockFetch
        .mockResolvedValueOnce({ // API key validation
          ok: true,
          json: () => Promise.resolve({ self: mockUser })
        })
        .mockResolvedValueOnce({ // Session creation
          ok: true,
          json: () => Promise.resolve({
            id: 1,
            session_id: 'session-abc-123',
            user_id: mockUser.id,
            client_info: {},
            last_active: '2025-01-01T00:00:00Z',
            status: 'active'
          })
        })
        .mockResolvedValueOnce({ // Usage logging
          ok: true,
          json: () => Promise.resolve({
            id: 1,
            session_id: 'session-abc-123',
            user_id: mockUser.id,
            function_id: 1
          })
        })

      // Act & Assert
      // 1. Validate API key
      const authResult = await authService.validateApiKey(apiKey)
      expect(authResult.valid).toBe(true)
      expect(authResult.user?.id).toBe(mockUser.id)

      // 2. Create session
      const session = await authService.createSession(mockUser.id, {})
      expect(session.user_id).toBe(mockUser.id)
      expect(session.status).toBe('active')

      // 3. Log tool usage
      const usageLog = await authService.logUsage({
        session_id: session.session_id,
        user_id: mockUser.id,
        function_id: 1
      })
      expect(usageLog.session_id).toBe(session.session_id)

      // Verify all API calls were made
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should prevent unauthorized access without valid API key', async () => {
      // Arrange
      const invalidApiKey = 'invalid-key'
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' })
      })

      // Act
      const authResult = await authService.validateApiKey(invalidApiKey)

      // Assert
      expect(authResult.valid).toBe(false)
      
      // Should not attempt to create session or log usage
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })
})