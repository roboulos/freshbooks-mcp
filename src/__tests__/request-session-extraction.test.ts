/**
 * TDD Tests for Request SessionId Extraction
 * 
 * These tests verify that sessionId is properly extracted from incoming requests
 * and made available to tools for usage logging - addressing Worker hibernation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the MyMCP class structure for testing
class MockMyMCP {
  props?: any;
  env?: any;
  currentRequest?: Request;

  constructor() {
    this.props = {};
    this.env = {};
  }

  // Method under test - should extract sessionId from request and enhance props
  async onNewRequest(req: Request, env: any): Promise<[Request, any, unknown]> {
    // This will be implemented to pass the tests
    throw new Error('Not implemented yet - TDD approach');
  }

  // Method that tools will use to get session info for logging
  async getSessionInfo(): Promise<{ sessionId: string; userId: string } | null> {
    // This will be implemented to pass the tests
    throw new Error('Not implemented yet - TDD approach');
  }

  // Simulate tool execution with session logging
  async executeToolWithLogging(toolName: string): Promise<{ logged: boolean; sessionId?: string }> {
    // This will be implemented to pass the tests
    throw new Error('Not implemented yet - TDD approach');
  }
}

describe('Request SessionId Extraction (TDD)', () => {
  let mockWorker: MockMyMCP;
  let mockEnv: any;

  beforeEach(() => {
    mockWorker = new MockMyMCP();
    mockEnv = {
      XANO_BASE_URL: 'https://test.xano.io',
      SESSION_CACHE: {
        get: vi.fn(),
        put: vi.fn()
      }
    };
  });

  describe('onNewRequest SessionId Extraction', () => {
    it('should extract sessionId from URL parameters and add to props', async () => {
      // EXPECTED BEHAVIOR: sessionId in URL becomes part of props
      const sessionId = '9c00f73baaa4b6e00ea0e2fa144af62c331029d1851fbff55cb241448cd888f1';
      const mockRequest = new Request(`https://worker.dev/sse/message?sessionId=${sessionId}`);
      
      const mockProps = {
        authenticated: true,
        userId: 'user-123',
        apiKey: 'api-key-456'
      };

      // Simulate parent class returning basic props
      const parentResult: [Request, any, unknown] = [mockRequest, mockProps, {}];
      
      const [request, enhancedProps, ctx] = await mockWorker.onNewRequest(mockRequest, mockEnv);
      
      expect(enhancedProps).toEqual({
        authenticated: true,
        userId: 'user-123',
        apiKey: 'api-key-456',
        sessionId: sessionId  // Should be added from URL
      });
      expect(request).toBe(mockRequest);
    });

    it('should handle requests without sessionId gracefully', async () => {
      // EXPECTED BEHAVIOR: Missing sessionId should not break props enhancement
      const mockRequest = new Request('https://worker.dev/sse/message');  // No sessionId
      
      const mockProps = {
        authenticated: true,
        userId: 'user-123',
        apiKey: 'api-key-456'
      };

      const [request, enhancedProps, ctx] = await mockWorker.onNewRequest(mockRequest, mockEnv);
      
      expect(enhancedProps).toEqual({
        authenticated: true,
        userId: 'user-123',
        apiKey: 'api-key-456',
        sessionId: null  // Should be null when missing from URL
      });
    });

    it('should preserve existing sessionId in props if URL sessionId is missing', async () => {
      // EXPECTED BEHAVIOR: Existing props.sessionId takes precedence over null URL sessionId
      const mockRequest = new Request('https://worker.dev/sse/message');  // No sessionId in URL
      
      const mockProps = {
        authenticated: true,
        userId: 'user-123',
        apiKey: 'api-key-456',
        sessionId: 'existing-session-from-props'
      };

      const [request, enhancedProps, ctx] = await mockWorker.onNewRequest(mockRequest, mockEnv);
      
      expect(enhancedProps).toEqual({
        authenticated: true,
        userId: 'user-123',
        apiKey: 'api-key-456',
        sessionId: 'existing-session-from-props'  // Should preserve existing value
      });
    });

    it('should prioritize URL sessionId over existing props sessionId', async () => {
      // EXPECTED BEHAVIOR: URL sessionId is more current than props sessionId
      const urlSessionId = 'fresh-session-from-url';
      const mockRequest = new Request(`https://worker.dev/sse/message?sessionId=${urlSessionId}`);
      
      const mockProps = {
        authenticated: true,
        userId: 'user-123',
        apiKey: 'api-key-456',
        sessionId: 'stale-session-from-props'
      };

      const [request, enhancedProps, ctx] = await mockWorker.onNewRequest(mockRequest, mockEnv);
      
      expect(enhancedProps).toEqual({
        authenticated: true,
        userId: 'user-123',
        apiKey: 'api-key-456',
        sessionId: urlSessionId  // Should use fresh URL sessionId
      });
    });
  });

  describe('getSessionInfo from Enhanced Props', () => {
    it('should return sessionId and userId from enhanced props', async () => {
      // EXPECTED BEHAVIOR: Tools can access sessionId from props for logging
      mockWorker.props = {
        authenticated: true,
        userId: 'user-789',
        sessionId: 'session-abc-123',
        apiKey: 'api-key-def-456'
      };

      const sessionInfo = await mockWorker.getSessionInfo();
      
      expect(sessionInfo).toEqual({
        sessionId: 'session-abc-123',
        userId: 'user-789'
      });
    });

    it('should return null when not authenticated', async () => {
      // EXPECTED BEHAVIOR: No session info without authentication
      mockWorker.props = {
        authenticated: false,
        userId: 'user-789',
        sessionId: 'session-abc-123'
      };

      const sessionInfo = await mockWorker.getSessionInfo();
      
      expect(sessionInfo).toBeNull();
    });

    it('should return null when sessionId is missing from props', async () => {
      // EXPECTED BEHAVIOR: No session info without sessionId
      mockWorker.props = {
        authenticated: true,
        userId: 'user-789'
        // sessionId missing
      };

      const sessionInfo = await mockWorker.getSessionInfo();
      
      expect(sessionInfo).toBeNull();
    });

    it('should return null when userId is missing from props', async () => {
      // EXPECTED BEHAVIOR: No session info without userId
      mockWorker.props = {
        authenticated: true,
        sessionId: 'session-abc-123'
        // userId missing
      };

      const sessionInfo = await mockWorker.getSessionInfo();
      
      expect(sessionInfo).toBeNull();
    });
  });

  describe('Tool Execution with Session Logging', () => {
    it('should successfully log tool usage when sessionId is available in props', async () => {
      // EXPECTED BEHAVIOR: Tools can log usage with sessionId from URL extraction
      mockWorker.props = {
        authenticated: true,
        userId: 'user-456',
        sessionId: 'tool-session-xyz-789',
        apiKey: 'api-key-abc-123'
      };

      const result = await mockWorker.executeToolWithLogging('xano_list_tables');
      
      expect(result.logged).toBe(true);
      expect(result.sessionId).toBe('tool-session-xyz-789');
    });

    it('should skip logging when sessionId is not available', async () => {
      // EXPECTED BEHAVIOR: Tools skip logging when no sessionId available
      mockWorker.props = {
        authenticated: true,
        userId: 'user-456',
        apiKey: 'api-key-abc-123'
        // sessionId missing
      };

      const result = await mockWorker.executeToolWithLogging('xano_list_tables');
      
      expect(result.logged).toBe(false);
      expect(result.sessionId).toBeUndefined();
    });

    it('should skip logging when not authenticated', async () => {
      // EXPECTED BEHAVIOR: Tools skip logging when not authenticated
      mockWorker.props = {
        authenticated: false,
        userId: 'user-456',
        sessionId: 'session-def-456',
        apiKey: 'api-key-abc-123'
      };

      const result = await mockWorker.executeToolWithLogging('xano_list_tables');
      
      expect(result.logged).toBe(false);
      expect(result.sessionId).toBeUndefined();
    });
  });

  describe('Integration with Worker Hibernation', () => {
    it('should handle multiple requests with different sessionIds correctly', async () => {
      // EXPECTED BEHAVIOR: Each request gets fresh sessionId extraction
      const firstSessionId = 'session-first-request';
      const secondSessionId = 'session-second-request';
      
      // First request
      const firstRequest = new Request(`https://worker.dev/sse/message?sessionId=${firstSessionId}`);
      const firstProps = { authenticated: true, userId: 'user-123', apiKey: 'api-key' };
      
      const [, firstEnhancedProps] = await mockWorker.onNewRequest(firstRequest, mockEnv);
      expect(firstEnhancedProps.sessionId).toBe(firstSessionId);
      
      // Second request (simulating Worker hibernation and new instance)
      const secondRequest = new Request(`https://worker.dev/sse/message?sessionId=${secondSessionId}`);
      const secondProps = { authenticated: true, userId: 'user-123', apiKey: 'api-key' };
      
      const [, secondEnhancedProps] = await mockWorker.onNewRequest(secondRequest, mockEnv);
      expect(secondEnhancedProps.sessionId).toBe(secondSessionId);
      
      // Should be different sessionIds
      expect(firstEnhancedProps.sessionId).not.toBe(secondEnhancedProps.sessionId);
    });

    it('should work with real Claude Code sessionId format', async () => {
      // EXPECTED BEHAVIOR: Handle actual sessionId format from Claude Code
      const realSessionId = '9c00f73baaa4b6e00ea0e2fa144af62c331029d1851fbff55cb241448cd888f1';
      const mockRequest = new Request(`https://worker.dev/sse/message?sessionId=${realSessionId}`);
      
      const mockProps = {
        authenticated: true,
        userId: 'user-123',
        apiKey: 'very-long-api-key-that-would-exceed-kv-limits'
      };

      const [request, enhancedProps, ctx] = await mockWorker.onNewRequest(mockRequest, mockEnv);
      
      expect(enhancedProps.sessionId).toBe(realSessionId);
      expect(enhancedProps.sessionId).toHaveLength(64); // SHA-256 hex length
    });
  });
});