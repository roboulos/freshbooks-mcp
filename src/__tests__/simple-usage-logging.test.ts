import { describe, it, expect, vi, beforeEach } from 'vitest';

// Simple general usage logging - fire and forget
describe('General Usage Logging', () => {
  let mockEnv: any;
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    
    mockEnv = {
      XANO_BASE_URL: 'https://test.xano.io'
    };
  });

  it('should log any usage activity asynchronously', async () => {
    // Mock successful response from Xano usage logging endpoint
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, id: 123 })
    });

    const { logUsage } = await import('../usage-logger');

    // Simple usage log call - fire and forget
    logUsage('tool_executed', {
      userId: 'user-123',
      sessionId: 'session-456',
      details: { tool: 'xano_list_instances', success: true },
      env: mockEnv
    });

    // Give it a moment to fire async
    await new Promise(resolve => setTimeout(resolve, 10));

    // Should call Xano usage logging endpoint
    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.xano.io/api:Snappy/usage_logs',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: expect.stringContaining('tool_executed')
      })
    );
  });

  it('should not throw if usage logging fails', async () => {
    // Mock failed response from Xano
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { logUsage } = await import('../usage-logger');

    // Should not throw even if logging fails
    expect(() => {
      logUsage('error_test', {
        userId: 'user-123',
        sessionId: 'session-456', 
        details: { error: 'test' },
        env: mockEnv
      });
    }).not.toThrow();
  });

  it('should handle minimal usage logging', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    const { logUsage } = await import('../usage-logger');

    // Minimal call with just event type
    logUsage('session_start', {
      sessionId: 'session-789',
      env: mockEnv
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/usage_logs'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('session_start')
      })
    );
  });
});