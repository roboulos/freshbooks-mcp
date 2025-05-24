import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MCPAuthMiddleware } from '../mcp-auth-middleware'
import { XanoAuthService } from '../auth-service'
import { ServiceAuthFactory } from '../service-auth-factory'

describe('MCP Worker Integration', () => {
  let mockEnv: any
  let mockCtx: any
  let middleware: MCPAuthMiddleware

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock environment
    mockEnv = {
      XANO_BASE_URL: 'https://test.xano.io',
      XANO_API_ENDPOINT: '/api:test',
      SESSION_CACHE: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
      },
      USAGE_QUEUE: {
        send: vi.fn()
      },
      SERVICE_CREDENTIALS: {
        xano: {
          service_name: 'xano',
          auth_type: 'api_key',
          credentials_encrypted: 'encrypted:{"api_key":"test-xano-key","base_url":"https://test.xano.io"}'
        },
        gmail: {
          service_name: 'gmail',
          auth_type: 'oauth',
          client_id: 'gmail-client-id',
          client_secret: 'gmail-client-secret'
        }
      }
    }

    mockCtx = {
      waitUntil: vi.fn()
    }

    middleware = new MCPAuthMiddleware(
      new XanoAuthService(mockEnv),
      new ServiceAuthFactory(),
      mockEnv
    )
  })

  describe('MCP Request Flow', () => {
    it('should authenticate incoming MCP requests', async () => {
      const request = new Request('http://localhost:8787/mcp', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'xano_list_instances'
          },
          id: 1
        })
      })

      // Mock successful auth
      const mockFetch = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify({
          self: {
            id: 'user-123',
            email: 'test@example.com',
            api_key: 'test-api-key'
          }
        }), { status: 200 })
      })
      global.fetch = mockFetch

      const result = await middleware.authenticate(request, mockEnv)
      
      expect(result.authenticated).toBe(true)
      expect(result.userId).toBe('user-123')
      expect(result.sessionId).toBeDefined()
    })

    it('should reject requests without API key', async () => {
      const request = new Request('http://localhost:8787/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'xano_list_instances' },
          id: 1
        })
      })

      const result = await middleware.authenticate(request, mockEnv)
      
      expect(result.authenticated).toBe(false)
      expect(result.error).toBe('Missing API key')
    })

    it('should inject service credentials into tool calls', async () => {
      const toolCall = {
        name: 'xano_list_instances',
        arguments: {}
      }

      const serviceAuth = middleware.getServiceAuth('xano', mockEnv)
      const credentials = await serviceAuth.getCredentials()

      expect(credentials).toEqual({
        api_key: 'test-xano-key',
        base_url: 'https://test.xano.io'
      })
    })
  })

  describe('Tool Call Wrapping', () => {
    it('should wrap tool calls with authentication', async () => {
      const originalHandler = vi.fn().mockResolvedValue({
        success: true,
        data: { instances: [] }
      })

      const wrappedHandler = middleware.wrapToolCall(
        'xano_list_instances',
        originalHandler,
        'session-123',
        'user-123',
        mockEnv
      )

      const result = await wrappedHandler({})
      
      expect(originalHandler).toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(mockEnv.USAGE_QUEUE.send).toHaveBeenCalled()
    })

    it('should handle OAuth tools like Gmail', async () => {
      const originalHandler = vi.fn().mockResolvedValue({
        success: true,
        data: { emails: [] }
      })

      // Mock OAuth token in KV
      mockEnv.SESSION_CACHE.get.mockImplementation(async (key) => {
        if (key === 'oauth:gmail:user-123') {
          return JSON.stringify({
            access_token: 'gmail-access-token',
            refresh_token: 'gmail-refresh-token',
            expires_at: new Date(Date.now() + 3600000).toISOString()
          })
        }
        return null
      })

      const wrappedHandler = middleware.wrapToolCall(
        'gmail_send_email',
        originalHandler,
        'session-123',
        'user-123',
        mockEnv
      )

      const result = await wrappedHandler({
        to: ['test@example.com'],
        subject: 'Test',
        body: 'Test email'
      })
      
      expect(originalHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['test@example.com'],
          subject: 'Test',
          body: 'Test email',
          _auth: expect.objectContaining({
            access_token: 'gmail-access-token'
          })
        })
      )
    })

    it('should track usage for each tool call', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true })
      const wrappedHandler = middleware.wrapToolCall(
        'xano_create_table',
        handler,
        'session-123',
        'user-123',
        mockEnv
      )

      await wrappedHandler({ name: 'test_table' })

      expect(mockEnv.USAGE_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('xano_create_table')
        })
      )
    })
  })

  describe('Session Management', () => {
    it('should maintain session across multiple requests', async () => {
      const apiKey = 'test-api-key'
      
      // First request - creates session
      const request1 = new Request('http://localhost:8787/mcp', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'xano_list_instances' },
          id: 1
        })
      })

      // Mock successful auth
      const mockFetch = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify({
          self: {
            id: 'user-123',
            api_key: apiKey
          }
        }), { status: 200 })
      })
      global.fetch = mockFetch

      const result1 = await middleware.authenticate(request1, mockEnv)
      const sessionId = result1.sessionId

      // Second request - should use cached session and API key
      mockEnv.SESSION_CACHE.get.mockImplementation(async (key) => {
        if (key === `apikey:${apiKey}`) {
          return JSON.stringify({
            userId: 'user-123',
            sessionId: sessionId,
            valid: true,
            cachedAt: new Date().toISOString()
          })
        }
        if (key === `session:${sessionId}`) {
          return JSON.stringify({
            sessionId,
            userId: 'user-123',
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString()
          })
        }
        return null
      })

      const request2 = new Request('http://localhost:8787/mcp', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'xano_get_table_schema' },
          id: 2
        })
      })

      const result2 = await middleware.authenticate(request2, mockEnv)
      
      expect(result2.sessionId).toBe(sessionId)
      expect(mockFetch).toHaveBeenCalledTimes(1) // Only called once for first request
    })

    it('should expire sessions after 24 hours', async () => {
      const apiKey = 'test-api-key'
      const oldSession = {
        sessionId: 'old-session',
        userId: 'user-123',
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
        lastActivity: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
      }

      mockEnv.SESSION_CACHE.get.mockResolvedValue(JSON.stringify(oldSession))

      const request = new Request('http://localhost:8787/mcp', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'xano_list_instances' },
          id: 1
        })
      })

      // Mock auth service
      const mockFetch = vi.fn().mockImplementation(async () => {
        return new Response(JSON.stringify({
          self: {
            id: 'user-123',
            api_key: apiKey
          }
        }), { status: 200 })
      })
      global.fetch = mockFetch

      const result = await middleware.authenticate(request, mockEnv)
      
      expect(result.sessionId).not.toBe('old-session')
      expect(mockFetch).toHaveBeenCalled() // Should re-authenticate
    })
  })

  describe('Error Handling', () => {
    it('should handle authentication failures gracefully', async () => {
      const request = new Request('http://localhost:8787/mcp', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer invalid-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'xano_list_instances' },
          id: 1
        })
      })

      // Mock failed auth
      const mockFetch = vi.fn().mockImplementation(async () => {
        return new Response('Unauthorized', { status: 401 })
      })
      global.fetch = mockFetch

      const result = await middleware.authenticate(request, mockEnv)
      
      expect(result.authenticated).toBe(false)
      expect(result.error).toContain('Invalid API key')
    })

    it('should handle tool execution failures', async () => {
      const failingHandler = vi.fn().mockRejectedValue(new Error('Tool error'))
      
      const wrappedHandler = middleware.wrapToolCall(
        'xano_create_table',
        failingHandler,
        'session-123',
        'user-123',
        mockEnv
      )

      await expect(wrappedHandler({})).rejects.toThrow('Tool error')
      
      // Should still log usage even on failure
      expect(mockEnv.USAGE_QUEUE.send).toHaveBeenCalled()
    })

    it('should continue working if usage logging fails', async () => {
      mockEnv.USAGE_QUEUE.send.mockRejectedValue(new Error('Queue error'))
      
      const handler = vi.fn().mockResolvedValue({ success: true })
      const wrappedHandler = middleware.wrapToolCall(
        'xano_list_instances',
        handler,
        'session-123',
        'user-123',
        mockEnv
      )

      const result = await wrappedHandler({})
      
      expect(result.success).toBe(true)
      expect(mockEnv.USAGE_QUEUE.send).toHaveBeenCalled()
    })
  })
})