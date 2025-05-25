import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAuthTokensInKV, interceptSSEMessage } from '../sse-jwt-helpers';

/**
 * Tests for JWT validation during SSE message processing
 * These tests verify that JWT expiry is detected during tool execution
 * and that OAuth re-authentication is triggered when needed
 */

describe('SSE Message JWT Interception', () => {
  let mockEnv: any;
  let mockRequest: Request;
  let mockProps: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockEnv = {
      XANO_BASE_URL: 'https://xnwv-v1z6-dvnr.n7c.xano.io',
      OAUTH_KV: {
        list: vi.fn(),
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
      }
    };

    mockRequest = new Request('https://example.com/sse/message?sessionId=test-session-123');
    
    mockProps = {
      authenticated: true,
      userId: '17b6fc02-966c-4642-babe-e8004afffc46',
      apiKey: 'existing-api-key',
      name: 'Robert',
      email: 'robertjboulos@gmail.com'
    };

    global.fetch = vi.fn();
  });

  describe('Token Storage Patterns', () => {
    it('should find JWT in xano_auth_token: entries when available', async () => {
      // Mock the KV storage pattern we see in production
      mockEnv.OAUTH_KV.list.mockImplementation(async (opts: any) => {
        if (opts.prefix === 'xano_auth_token:') {
          return { 
            keys: [{ 
              name: 'xano_auth_token:17b6fc02-966c-4642-babe-e8004afffc46' 
            }] 
          };
        }
        return { keys: [] };
      });

      mockEnv.OAUTH_KV.get.mockResolvedValue(JSON.stringify({
        userId: '17b6fc02-966c-4642-babe-e8004afffc46',
        apiKey: 'xano-api-key-123',
        authToken: 'eyJhbGciOi...jwt-token', // Xano JWT
        email: 'robertjboulos@gmail.com',
        name: 'Robert',
        lastRefreshed: new Date().toISOString()
      }));

      // This should find and use the JWT
      const result = await checkAuthTokensInKV(mockEnv, mockProps.userId);
      
      expect(result).toEqual({
        found: true,
        authToken: 'eyJhbGciOi...jwt-token',
        source: 'xano_auth_token'
      });
    });

    it('should fallback to token: entries when xano_auth_token not found', async () => {
      // This is the current production pattern - no xano_auth_token entries
      mockEnv.OAUTH_KV.list.mockImplementation(async (opts: any) => {
        if (opts.prefix === 'xano_auth_token:') {
          return { keys: [] };
        }
        if (opts.prefix === 'token:') {
          return { 
            keys: [{ 
              name: 'token:abc-123-def' 
            }] 
          };
        }
        return { keys: [] };
      });

      mockEnv.OAUTH_KV.get.mockResolvedValue(JSON.stringify({
        userId: '17b6fc02-966c-4642-babe-e8004afffc46',
        accessToken: 'eyJhbGciOi...jwt-token', // Note: stored as accessToken not authToken
        apiKey: 'xano-api-key-123'
      }));

      const result = await checkAuthTokensInKV(mockEnv, mockProps.userId);
      
      expect(result).toEqual({
        found: true,
        authToken: 'eyJhbGciOi...jwt-token',
        source: 'token'
      });
    });

    it('should handle case where no auth tokens exist', async () => {
      mockEnv.OAUTH_KV.list.mockResolvedValue({ keys: [] });

      const result = await checkAuthTokensInKV(mockEnv, mockProps.userId);
      
      expect(result).toEqual({
        found: false,
        authToken: null,
        source: null
      });
    });
  });

  describe('onSSEMcpMessage JWT Validation', () => {
    it('should check JWT validity before processing tool calls', async () => {
      // Setup token in KV
      mockEnv.OAUTH_KV.list.mockImplementation(async (opts: any) => {
        if (opts.prefix === 'xano_auth_token:') {
          return { keys: [{ name: 'xano_auth_token:17b6fc02-966c-4642-babe-e8004afffc46' }] };
        }
        return { keys: [] };
      });

      mockEnv.OAUTH_KV.get.mockResolvedValue(JSON.stringify({
        authToken: 'valid-jwt',
        userId: mockProps.userId,
        apiKey: 'api-key'
      }));

      // Mock successful auth/me
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      const result = await interceptSSEMessage(
        'test-session', 
        mockRequest, 
        mockProps, 
        mockEnv
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://xnwv-v1z6-dvnr.n7c.xano.io/api:e6emygx3/auth/me',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid-jwt'
          })
        })
      );

      expect(result.shouldContinue).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should block tool execution when JWT is expired', async () => {
      // Setup expired token
      mockEnv.OAUTH_KV.list.mockImplementation(async (opts: any) => {
        if (opts.prefix === 'xano_auth_token:') {
          return { keys: [{ name: 'xano_auth_token:17b6fc02-966c-4642-babe-e8004afffc46' }] };
        }
        return { keys: [] };
      });

      mockEnv.OAUTH_KV.get.mockResolvedValue(JSON.stringify({
        authToken: 'expired-jwt',
        userId: mockProps.userId
      }));

      // Mock 401 response
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const result = await interceptSSEMessage(
        'test-session', 
        mockRequest, 
        mockProps, 
        mockEnv
      );

      // Should have deleted all tokens
      expect(mockEnv.OAUTH_KV.delete).toHaveBeenCalled();

      // Should return error to block execution
      expect(result.shouldContinue).toBe(false);
      expect(result.error).toContain('Authentication expired');
      expect(result.updatedProps.authenticated).toBe(false);
    });

    it('should continue without JWT check for unauthenticated requests', async () => {
      const unauthProps = { authenticated: false };

      const result = await interceptSSEMessage(
        'test-session', 
        mockRequest, 
        unauthProps, 
        mockEnv
      );

      // Should not check KV or call auth/me
      expect(mockEnv.OAUTH_KV.list).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();

      expect(result.shouldContinue).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should handle network errors gracefully', async () => {
      // Setup token
      mockEnv.OAUTH_KV.list.mockImplementation(async (opts: any) => {
        if (opts.prefix === 'xano_auth_token:') {
          return { keys: [{ name: 'xano_auth_token:17b6fc02-966c-4642-babe-e8004afffc46' }] };
        }
        return { keys: [] };
      });

      mockEnv.OAUTH_KV.get.mockResolvedValue(JSON.stringify({
        authToken: 'some-jwt',
        userId: mockProps.userId
      }));

      // Mock network error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const result = await interceptSSEMessage(
        'test-session', 
        mockRequest, 
        mockProps, 
        mockEnv
      );

      // Should NOT delete tokens on network error
      expect(mockEnv.OAUTH_KV.delete).not.toHaveBeenCalled();

      // Should continue with existing auth
      expect(result.shouldContinue).toBe(true);
      expect(result.error).toBeNull();
      expect(result.updatedProps).toEqual(mockProps);
    });
  });

  describe('Real Production Scenario', () => {
    it('should handle the actual production token structure', async () => {
      // This mimics the exact structure we see in production logs
      mockEnv.OAUTH_KV.list.mockImplementation(async (opts: any) => {
        if (opts.prefix === 'xano_auth_token:') {
          return { keys: [] }; // Empty in production
        }
        if (opts.prefix === 'token:') {
          return { 
            keys: [{ name: 'token:2b6f0c2d-5e3b-4f7a-8c9d-1a2b3c4d5e6f' }] 
          };
        }
        return { keys: [] };
      });

      // The actual token structure from OAuth provider
      mockEnv.OAUTH_KV.get.mockResolvedValue(JSON.stringify({
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', // This is the Xano JWT
        userId: '17b6fc02-966c-4642-babe-e8004afffc46',
        email: 'robertjboulos@gmail.com',
        name: 'Robert',
        apiKey: 'long-xano-api-key-1211-chars',
        metadata: {
          label: 'Robert'
        }
      }));

      // Mock successful JWT validation
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      const result = await interceptSSEMessage(
        'test-session', 
        mockRequest, 
        mockProps, 
        mockEnv
      );

      // Should find and check the JWT
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/me'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringMatching(/^Bearer eyJhbGc/)
          })
        })
      );
    });
  });
});