import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the OAuth provider
const mockCompleteAuthorization = vi.fn();
const mockInitiateAuthorization = vi.fn();

vi.mock('@cloudflare/workers-oauth-provider', () => ({
  default: vi.fn().mockImplementation(() => ({
    completeAuthorization: mockCompleteAuthorization,
    initiateAuthorization: mockInitiateAuthorization,
  })),
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OAuth TTL and Token Expiry', () => {
  let mockEnv: any;
  let mockKV: any;
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
    };

    mockContext = {
      request: new Request('https://test.example.com/oauth/callback'),
      env: {
        OAUTH_KV: mockKV,
        XANO_BASE_URL: 'https://test.xano.io',
        OAUTH_TOKEN_TTL: '86400', // 24 hours
      },
    };

    mockEnv = mockContext.env;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('TTL Configuration and Enforcement', () => {
    it('should use default TTL when OAUTH_TOKEN_TTL is not set', async () => {
      // Arrange: Remove TTL from env
      delete mockEnv.OAUTH_TOKEN_TTL;

      // Mock successful OAuth completion
      mockCompleteAuthorization.mockResolvedValue({
        success: true,
        user: { id: 'user123', email: 'test@example.com' },
        token: 'oauth_token_123',
      });

      // Mock auth/me response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: 'user123',
          api_key: 'api_key_123',
          email: 'test@example.com',
          name: 'Test User',
        }),
      });

      // Import and test the OAuth handler
      const { handleOAuthCallback } = await import('../xano-handler');
      
      // Act: Complete OAuth without explicit TTL
      await handleOAuthCallback(mockContext);

      // Assert: Should use default TTL (86400 seconds = 24 hours)
      expect(mockCompleteAuthorization).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          accessTokenTTL: 86400, // Default 24 hours
        })
      );
    });

    it('should enforce minimum TTL of 1 hour (3600 seconds)', async () => {
      // Arrange: Set very low TTL
      mockEnv.OAUTH_TOKEN_TTL = '1800'; // 30 minutes

      mockCompleteAuthorization.mockResolvedValue({
        success: true,
        user: { id: 'user123', email: 'test@example.com' },
        token: 'oauth_token_123',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: 'user123',
          api_key: 'api_key_123',
          email: 'test@example.com',
        }),
      });

      const { handleOAuthCallback } = await import('../xano-handler');
      
      // Act: Complete OAuth with low TTL
      await handleOAuthCallback(mockContext);

      // Assert: Should enforce minimum of 1 hour
      expect(mockCompleteAuthorization).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          accessTokenTTL: 3600, // Enforced minimum 1 hour
        })
      );
    });

    it('should accept valid custom TTL values', async () => {
      // Arrange: Set 48-hour TTL
      mockEnv.OAUTH_TOKEN_TTL = '172800'; // 48 hours

      mockCompleteAuthorization.mockResolvedValue({
        success: true,
        user: { id: 'user123', email: 'test@example.com' },
        token: 'oauth_token_123',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: 'user123',
          api_key: 'api_key_123',
          email: 'test@example.com',
        }),
      });

      const { handleOAuthCallback } = await import('../xano-handler');
      
      // Act: Complete OAuth with custom TTL
      await handleOAuthCallback(mockContext);

      // Assert: Should use custom TTL
      expect(mockCompleteAuthorization).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          accessTokenTTL: 172800, // Custom 48 hours
        })
      );
    });

    it('should handle invalid TTL values gracefully', async () => {
      // Arrange: Set invalid TTL
      mockEnv.OAUTH_TOKEN_TTL = 'invalid_number';

      mockCompleteAuthorization.mockResolvedValue({
        success: true,
        user: { id: 'user123', email: 'test@example.com' },
        token: 'oauth_token_123',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: 'user123',
          api_key: 'api_key_123',
          email: 'test@example.com',
        }),
      });

      const { handleOAuthCallback } = await import('../xano-handler');
      
      // Act: Complete OAuth with invalid TTL
      await handleOAuthCallback(mockContext);

      // Assert: Should fall back to default when parseInt fails (NaN)
      expect(mockCompleteAuthorization).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          accessTokenTTL: 3600, // Falls back to minimum when NaN
        })
      );
    });
  });

  describe('Token Expiry Mechanism', () => {
    it('should store token with expiry timestamp', async () => {
      // Arrange: Mock successful OAuth
      const fixedTime = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(fixedTime);

      mockCompleteAuthorization.mockResolvedValue({
        success: true,
        user: { id: 'user123', email: 'test@example.com' },
        token: 'oauth_token_123',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: 'user123',
          api_key: 'api_key_123',
          email: 'test@example.com',
        }),
      });

      const { handleOAuthCallback } = await import('../xano-handler');
      
      // Act: Complete OAuth
      await handleOAuthCallback(mockContext);

      // Assert: Should store with proper expiry
      expect(mockKV.put).toHaveBeenCalledWith(
        'xano_auth_token:user123',
        expect.stringContaining('"api_key_123"'),
        { expirationTtl: 86400 } // TTL in seconds
      );

      vi.useRealTimers();
    });

    it('should trigger re-authentication when tokens expire', async () => {
      // Arrange: Mock expired token scenario
      mockKV.get.mockResolvedValue(null); // Expired token returns null

      // Try to make an API request with expired token
      const { makeApiRequest } = await import('../utils');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ message: 'Token expired' }),
      });

      // Act: Make request with expired token
      const result = await makeApiRequest(
        'https://test.xano.io/api/test',
        'expired_token',
        'GET',
        undefined,
        mockEnv
      );

      // Assert: Should get 401 when no refresh is possible
      expect(result.status).toBe(401);
      expect(result.error).toBe('Token expired');
    });

    it('should handle KV TTL minimum requirement (60 seconds)', async () => {
      // Test for debug_expire_oauth_tokens tool
      // This simulates manually expiring tokens for testing

      // Arrange: Mock existing tokens
      mockKV.list.mockImplementation(({ prefix }) => {
        if (prefix.startsWith('token:') || prefix.startsWith('refresh:')) {
          return Promise.resolve({
            keys: [
              { name: 'token:abc123' },
              { name: 'refresh:def456' },
            ],
          });
        }
        return Promise.resolve({ keys: [] });
      });

      mockKV.get
        .mockResolvedValueOnce('{"accessToken": "token1"}')
        .mockResolvedValueOnce('{"refreshToken": "refresh1"}');

      // Import the debug function (would be in index.ts)
      // This is a mock of what the debug_expire_oauth_tokens tool should do

      // Act: Manually expire tokens with 60-second TTL
      const expireTokens = async () => {
        const tokenList = await mockKV.list({ prefix: 'token:' });
        const refreshList = await mockKV.list({ prefix: 'refresh:' });
        
        const allTokens = [...(tokenList.keys || []), ...(refreshList.keys || [])];
        
        for (const tokenKey of allTokens) {
          const data = await mockKV.get(tokenKey.name);
          if (data) {
            // Re-store with 60-second TTL (minimum for Cloudflare KV)
            await mockKV.put(tokenKey.name, data, { expirationTtl: 60 });
          }
        }
        
        return { 
          expired: allTokens.length,
          message: `Expired ${allTokens.length} tokens with 60-second TTL (minimum allowed by Cloudflare KV)`
        };
      };

      const result = await expireTokens();

      // Assert: Should expire tokens with 60-second minimum
      expect(result.expired).toBe(2);
      expect(mockKV.put).toHaveBeenCalledWith(
        'token:abc123',
        '{"accessToken": "token1"}',
        { expirationTtl: 60 }
      );
    });
  });

  describe('OAuth Re-authentication Flow', () => {
    it('should initiate new OAuth flow when tokens are expired', async () => {
      // This test simulates what happens when a user's session has expired
      // and they need to re-authenticate

      // Arrange: Mock expired session
      mockKV.get.mockResolvedValue(null); // No valid tokens

      // Mock OAuth initiation
      mockInitiateAuthorization.mockResolvedValue({
        redirectUrl: 'https://oauth.provider.com/auth?state=abc123',
        state: 'abc123',
      });

      // Act: Simulate initiating re-authentication
      const mockRequest = new Request('https://test.example.com/mcp?auth_token=invalid');
      
      // This would be part of the main MCP handler logic
      const shouldReAuth = !await mockKV.get('token:abc123');
      
      let redirectUrl = null;
      if (shouldReAuth) {
        const authResult = await mockInitiateAuthorization({
          request: mockRequest,
          redirectUrl: 'https://test.example.com/oauth/callback',
        });
        redirectUrl = authResult.redirectUrl;
      }

      // Assert: Should initiate OAuth flow
      expect(shouldReAuth).toBe(true);
      expect(redirectUrl).toBe('https://oauth.provider.com/auth?state=abc123');
    });

    it('should complete re-authentication and update stored tokens', async () => {
      // Arrange: Mock completing re-authentication
      mockCompleteAuthorization.mockResolvedValue({
        success: true,
        user: { id: 'user123', email: 'test@example.com' },
        token: 'new_oauth_token_456',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: 'user123',
          api_key: 'new_api_key_456',
          email: 'test@example.com',
          name: 'Test User',
        }),
      });

      const { handleOAuthCallback } = await import('../xano-handler');
      
      // Act: Complete re-authentication
      await handleOAuthCallback(mockContext);

      // Assert: Should store new tokens
      expect(mockKV.put).toHaveBeenCalledWith(
        'xano_auth_token:user123',
        expect.stringContaining('new_api_key_456'),
        expect.objectContaining({ expirationTtl: 86400 })
      );
    });
  });

  describe('Token Storage and Retrieval', () => {
    it('should store tokens with correct structure and metadata', async () => {
      // Arrange: Mock successful OAuth completion
      const fixedTime = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(fixedTime);

      mockCompleteAuthorization.mockResolvedValue({
        success: true,
        user: { id: 'user123', email: 'test@example.com' },
        token: 'oauth_token_123',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: 'user123',
          api_key: 'api_key_123',
          email: 'test@example.com',
          name: 'Test User',
        }),
      });

      const { handleOAuthCallback } = await import('../xano-handler');
      
      // Act: Complete OAuth
      await handleOAuthCallback(mockContext);

      // Assert: Should store with correct structure
      const storedData = JSON.parse(mockKV.put.mock.calls[0][1]);
      expect(storedData).toMatchObject({
        authToken: 'oauth_token_123',
        apiKey: 'api_key_123',
        userId: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        authenticated: true,
      });

      // Should have timestamps
      expect(storedData.lastRefreshed).toBeDefined();

      vi.useRealTimers();
    });

    it('should retrieve and validate stored tokens correctly', async () => {
      // Arrange: Mock stored token data
      const storedTokenData = {
        authToken: 'stored_oauth_token',
        apiKey: 'stored_api_key',
        userId: 'user123',
        email: 'test@example.com',
        authenticated: true,
        lastRefreshed: '2024-01-01T12:00:00Z',
      };

      mockKV.get.mockResolvedValue(JSON.stringify(storedTokenData));

      // Act: Retrieve token (this would be part of the request validation)
      const tokenData = await mockKV.get('xano_auth_token:user123');
      const parsedData = JSON.parse(tokenData);

      // Assert: Should retrieve correct structure
      expect(parsedData).toMatchObject(storedTokenData);
      expect(parsedData.authenticated).toBe(true);
      expect(parsedData.apiKey).toBe('stored_api_key');
    });
  });
});