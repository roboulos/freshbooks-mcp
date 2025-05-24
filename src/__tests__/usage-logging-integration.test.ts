import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MCPAuthMiddleware } from '../mcp-auth-middleware'

describe('Usage Logging Integration', () => {
  let middleware: MCPAuthMiddleware
  let mockEnv: any
  
  beforeEach(() => {
    // Mock environment with all required properties
    mockEnv = {
      SESSION_CACHE: {
        get: vi.fn(),
        put: vi.fn()
      },
      USAGE_QUEUE: {
        send: vi.fn()
      },
      XANO_BASE_URL: 'https://test.xano.io',
      XANO_API_ENDPOINT: '/api:test'
    }

    // Create middleware instance
    middleware = new MCPAuthMiddleware(undefined, undefined, mockEnv)
  })

  describe('Tool wrapping with usage logging', () => {
    it('should log usage when wrapped tool is called successfully', async () => {
      // Arrange - Mock a tool that returns test data with small delay
      const mockTool = vi.fn().mockImplementation(async () => {
        // Add small delay to ensure duration > 0
        await new Promise(resolve => setTimeout(resolve, 1))
        return {
          instances: [{ 
            name: 'test-instance', 
            display: 'Test Instance' 
          }]
        }
      })

      // Wrap the tool with usage logging
      const wrappedTool = middleware.wrapToolCall(
        'xano_list_instances',
        mockTool,
        'session-test-123',
        'user-test-456',
        mockEnv
      )

      // Act - Call the wrapped tool
      const result = await wrappedTool({ param: 'test' })

      // Assert - Tool should execute successfully
      expect(result).toBeDefined()
      expect(result.instances).toBeDefined()
      expect(mockTool).toHaveBeenCalledWith({ param: 'test' })

      // Assert - Usage should be logged to the queue
      expect(mockEnv.USAGE_QUEUE.send).toHaveBeenCalledTimes(1)
      
      // Verify the queued message contains expected data
      const queueCall = mockEnv.USAGE_QUEUE.send.mock.calls[0][0]
      expect(queueCall.body).toBeDefined()
      
      const logData = JSON.parse(queueCall.body)
      expect(logData).toMatchObject({
        sessionId: 'session-test-123',
        userId: 'user-test-456',
        toolName: 'xano_list_instances',
        params: { param: 'test' },
        timestamp: expect.any(String)
      })
      
      // Verify duration is recorded
      expect(logData.duration).toBeGreaterThan(0)
      expect(typeof logData.duration).toBe('number')
    })

    it('should log usage even when tool throws an error', async () => {
      // Arrange - Mock a tool that throws an error
      const mockTool = vi.fn().mockRejectedValue(new Error('Network error'))

      // Wrap the tool with usage logging
      const wrappedTool = middleware.wrapToolCall(
        'xano_list_instances',
        mockTool,
        'session-test-123',
        'user-test-456',
        mockEnv
      )

      // Act & Assert - Tool should throw error
      await expect(wrappedTool({})).rejects.toThrow('Network error')

      // Assert - Usage should still be logged even on error
      expect(mockEnv.USAGE_QUEUE.send).toHaveBeenCalledTimes(1)
      
      const queueCall = mockEnv.USAGE_QUEUE.send.mock.calls[0][0]
      const logData = JSON.parse(queueCall.body)
      
      expect(logData).toMatchObject({
        sessionId: 'session-test-123',
        userId: 'user-test-456',
        toolName: 'xano_list_instances',
        error: 'Network error'
      })
    })

    it('should generate unique session IDs for different calls', async () => {
      // Arrange - Mock a tool that returns data
      const mockTool = vi.fn().mockResolvedValue({ instances: [] })

      // Act - Call the wrapped tool twice with different session IDs
      const wrappedTool1 = middleware.wrapToolCall(
        'xano_list_instances',
        mockTool,
        'session-test-123',
        'user-test-456',
        mockEnv
      )
      
      const wrappedTool2 = middleware.wrapToolCall(
        'xano_list_instances', 
        mockTool,
        'session-test-789', // Different session ID
        'user-test-456',
        mockEnv
      )

      await wrappedTool1({})
      await wrappedTool2({})

      // Assert - Should have logged twice
      expect(mockEnv.USAGE_QUEUE.send).toHaveBeenCalledTimes(2)
      
      const call1 = JSON.parse(mockEnv.USAGE_QUEUE.send.mock.calls[0][0].body)
      const call2 = JSON.parse(mockEnv.USAGE_QUEUE.send.mock.calls[1][0].body)
      
      // Session IDs should be different
      expect(call1.sessionId).toBe('session-test-123')
      expect(call2.sessionId).toBe('session-test-789')
      expect(call1.userId).toBe(call2.userId) // Same user
      expect(call1.toolName).toBe('xano_list_instances')
      expect(call2.toolName).toBe('xano_list_instances')
    })
    
    it('should include cost and metadata in logged usage', async () => {
      // Arrange - Mock a tool
      const mockTool = vi.fn().mockResolvedValue({ success: true })

      const wrappedTool = middleware.wrapToolCall(
        'xano_list_instances',
        mockTool,
        'session-test-123',
        'user-test-456',
        mockEnv
      )

      // Act
      await wrappedTool({ test: 'param' })

      // Assert
      expect(mockEnv.USAGE_QUEUE.send).toHaveBeenCalledTimes(1)
      
      const queueCall = mockEnv.USAGE_QUEUE.send.mock.calls[0][0]
      const logData = JSON.parse(queueCall.body)
      
      // Should include metadata fields
      expect(logData).toMatchObject({
        sessionId: 'session-test-123',
        userId: 'user-test-456',
        toolName: 'xano_list_instances',
        params: { test: 'param' },
        result: { success: true },
        timestamp: expect.any(String),
        ip_address: '0.0.0.0',
        ai_model: 'claude-3',
        cost: expect.any(Number),
        duration: expect.any(Number)
      })
    })
  })
})