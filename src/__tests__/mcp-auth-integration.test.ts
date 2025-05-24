import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ExecutionContext } from '@cloudflare/workers-types'
import { createMCPAuthMiddleware, MCPAuthMiddleware, type AuthenticatedEnv } from '../mcp-auth-middleware'
import { XanoAuthService } from '../auth-service'
import { ServiceAuthFactory } from '../service-auth-factory'

// Mock types for MCP
interface MCPRequest {
  method: string
  params?: any
  id: number | string
  jsonrpc: '2.0'
}

interface MCPResponse {
  jsonrpc: '2.0'
  id: number | string
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

describe('MCP Authentication Integration', () => {
  let middleware: MCPAuthMiddleware
  let mockEnv: AuthenticatedEnv
  let mockRequest: Request
  let mockCtx: ExecutionContext
  
  beforeEach(() => {
    mockEnv = {
      KV: {
        get: vi.fn(),
        put: vi.fn()
      },
      SESSION_CACHE: {
        get: vi.fn(),
        put: vi.fn()
      },
      USAGE_QUEUE: {
        send: vi.fn()
      },
      XANO_API_KEY: 'test-worker-api-key',
      XANO_INSTANCE: 'xnwv-v1z6-dvnr',
      XANO_BASE_URL: 'https://test.xano.io',
      XANO_API_ENDPOINT: '/api:test'
    }
    
    global.fetch = vi.fn()
    
    // Create middleware instance
    middleware = createMCPAuthMiddleware(mockEnv)
  })

  describe('Request Authentication', () => {
    it('should authenticate requests with valid API key header', async () => {
      // Arrange
      mockRequest = new Request('https://mcp.example.com', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer user-api-key-123',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1
        })
      })

      // Mock successful Xano user validation
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        api_key: 'user-api-key-123',
        status: 'active'
      }
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ self: mockUser })
      })

      // Act
      const result = await middleware.authenticate(mockRequest, mockEnv)

      // Assert
      expect(result.authenticated).toBe(true)
      expect(result.userId).toBe('user-123')
      expect(result.sessionId).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('should reject requests without API key', async () => {
      // Arrange
      mockRequest = new Request('https://mcp.example.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1
        })
      })

      // Act
      const result = await middleware.authenticate(mockRequest, mockEnv)

      // Assert
      expect(result.authenticated).toBe(false)
      expect(result.error).toBe('Missing API key')
    })

    it('should cache successful authentications', async () => {
      // Arrange
      const apiKey = 'user-api-key-123'
      mockRequest = new Request('https://mcp.example.com', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      // First call - should hit Xano
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          self: { id: 'user-123', api_key: apiKey, status: 'active' }
        })
      })

      // Act - First authentication
      const result1 = await middleware.authenticate(mockRequest, mockEnv)
      
      // Mock SESSION_CACHE to return the cached API key
      mockEnv.SESSION_CACHE.get = vi.fn().mockImplementation(async (key) => {
        if (key === `apikey:${apiKey}`) {
          return JSON.stringify({
            userId: 'user-123',
            valid: true,
            cachedAt: new Date().toISOString()
          })
        }
        return null
      })
      
      // Reset fetch mock for second call
      global.fetch = vi.fn()
      
      // Act - Second authentication (should use cache)
      const result2 = await middleware.authenticate(mockRequest, mockEnv)

      // Assert
      expect(result1.authenticated).toBe(true)
      expect(result2.authenticated).toBe(true)
      expect(global.fetch).not.toHaveBeenCalled() // Second call uses cache
      expect(mockEnv.SESSION_CACHE.put).toHaveBeenCalled()
    })
  })

  describe('Tool Call Wrapping', () => {
    it('should wrap tool calls with usage logging', async () => {
      // Arrange
      const mockTool = vi.fn().mockResolvedValue({ success: true, data: [] })
      const wrappedTool = middleware.wrapToolCall(
        'xano_list_databases',
        mockTool,
        'session-123',
        'user-123',
        mockEnv
      )

      // Act
      const result = await wrappedTool({ instance_name: 'test' })

      // Assert
      expect(mockTool).toHaveBeenCalledWith({ instance_name: 'test' })
      expect(result).toEqual({ success: true, data: [] })
    })

    it('should log successful tool usage', async () => {
      // Arrange
      const mockTool = vi.fn().mockResolvedValue({ success: true })
      
      const wrappedTool = middleware.wrapToolCall(
        'xano_list_tables',
        mockTool,
        'session-123',
        'user-123',
        mockEnv
      )

      // Act
      await wrappedTool({ database_id: 5 })

      // Assert - Check that usage was queued
      expect(mockEnv.USAGE_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('xano_list_tables')
        })
      )
    })

    it('should log tool errors without blocking response', async () => {
      // Arrange
      const mockError = new Error('Tool failed')
      const mockTool = vi.fn().mockRejectedValue(mockError)
      
      const wrappedTool = middleware.wrapToolCall(
        'xano_create_table',
        mockTool,
        'session-123',
        'user-123',
        mockEnv
      )

      // Act & Assert
      await expect(wrappedTool({ name: 'test' })).rejects.toThrow('Tool failed')
      
      // Logging should still happen
      expect(mockEnv.USAGE_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('Tool failed')
        })
      )
    })
  })

  describe('Async Usage Logging', () => {
    it('should queue usage logs for batch processing', async () => {
      // Arrange
      const mockTool = vi.fn().mockResolvedValue({ success: true })
      
      const wrappedTool = middleware.wrapToolCall(
        'xano_list_databases',
        mockTool,
        'session-123',
        'user-123',
        mockEnv
      )

      // Act
      await wrappedTool({ instance_name: 'test' })

      // Assert - Should be queued via USAGE_QUEUE
      expect(global.fetch).not.toHaveBeenCalled()
      expect(mockEnv.USAGE_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.any(String)
        })
      )
      
      // Verify the body contains expected data
      const call = mockEnv.USAGE_QUEUE.send.mock.calls[0][0]
      const body = JSON.parse(call.body)
      expect(body).toMatchObject({
        sessionId: 'session-123',
        userId: 'user-123',
        toolName: 'xano_list_databases'
      })
    })

    it('should not block on logging failures', async () => {
      // Arrange
      mockEnv.KV.put = vi.fn().mockRejectedValue(new Error('KV error'))
      
      const usageData = {
        sessionId: 'session-123',
        userId: 'user-123',
        toolName: 'xano_list_tables',
        params: {},
        result: {},
        duration: 100
      }

      // Act - Should not throw
      await expect(middleware.logUsage(usageData)).resolves.not.toThrow()
    })
  })

  describe('Session Management', () => {
    it('should create new session for first-time users', async () => {
      // Arrange
      mockRequest = new Request('https://mcp.example.com', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer new-user-key',
          'Content-Type': 'application/json'
        }
      })

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          self: { id: 'new-user', api_key: 'new-user-key', status: 'active' }
        })
      })

      // Act
      const result = await middleware.authenticate(mockRequest, mockEnv)

      // Assert
      expect(result.authenticated).toBe(true)
      expect(result.sessionId).toMatch(/^session-\d+-[a-z0-9]+$/)
      expect(mockEnv.SESSION_CACHE.put).toHaveBeenCalledWith(
        expect.stringContaining(result.sessionId!),
        expect.any(String),
        expect.objectContaining({
          expirationTtl: expect.any(Number)
        })
      )
    })

    it('should reuse existing sessions within timeout period', async () => {
      // Arrange
      const existingSession = {
        sessionId: 'existing-session-123',
        userId: 'user-123',
        lastActive: new Date().toISOString()
      }
      
      mockEnv.SESSION_CACHE.get = vi.fn().mockResolvedValue(
        JSON.stringify(existingSession)
      )

      mockRequest = new Request('https://mcp.example.com', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer user-key',
          'X-Session-ID': 'existing-session-123'
        }
      })

      // Act
      const result = await middleware.authenticate(mockRequest, mockEnv)

      // Assert
      expect(result.sessionId).toBe('existing-session-123')
      expect(global.fetch).not.toHaveBeenCalled() // No need to validate again
    })
  })

  describe('End-to-End MCP Request Flow', () => {
    it('should handle complete MCP tool request with auth and logging', async () => {
      // Arrange
      const mcpRequest: MCPRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'xano_list_databases',
          arguments: { instance_name: 'test' }
        },
        id: 1
      }

      mockRequest = new Request('https://mcp.example.com', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-api-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mcpRequest)
      })

      // Mock successful auth
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          self: { id: 'user-123', api_key: 'valid-api-key', status: 'active' }
        })
      })

      // Act
      const authResult = await middleware.authenticate(mockRequest, mockEnv)
      expect(authResult.authenticated).toBe(true)

      // Simulate tool execution
      const mockToolHandler = vi.fn().mockResolvedValue({
        databases: [{ id: 1, name: 'Test DB' }]
      })

      const wrappedHandler = middleware.wrapToolCall(
        'xano_list_databases',
        mockToolHandler,
        authResult.sessionId!,
        authResult.userId!,
        mockEnv
      )

      const toolResult = await wrappedHandler({ instance_name: 'test' })

      // Assert
      expect(toolResult).toHaveProperty('databases')
      expect(mockToolHandler).toHaveBeenCalled()
      
      // Verify usage was queued
      expect(mockEnv.USAGE_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('xano_list_databases')
        })
      )
    })
  })
})