import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the auth/me check functionality that we'll implement
const checkJWTValidity = async (authToken: string, baseUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(`${baseUrl}/api:e6emygx3/auth/me`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    return response.ok;
  } catch (error) {
    throw error;
  }
};

// Mock the token deletion functionality
const deleteAllAuthTokens = async (env: any): Promise<number> => {
  const tokenEntries = await env.OAUTH_KV.list({ prefix: 'token:' });
  const xanoAuthEntries = await env.OAUTH_KV.list({ prefix: 'xano_auth_token:' });
  const refreshEntries = await env.OAUTH_KV.list({ prefix: 'refresh:' });
  
  let deletedCount = 0;
  
  for (const key of [...(tokenEntries.keys || []), ...(xanoAuthEntries.keys || []), ...(refreshEntries.keys || [])]) {
    await env.OAUTH_KV.delete(key.name);
    deletedCount++;
  }
  
  return deletedCount;
};

// Mock the onNewRequest enhancement for JWT checking
const enhancePropsWithJWTCheck = async (props: any, env: any): Promise<any> => {
  if (!props?.authenticated || !props?.userId) {
    return props;
  }

  // Look for auth token in KV
  const authEntries = await env.OAUTH_KV.list({ prefix: 'xano_auth_token:' });
  if (!authEntries.keys || authEntries.keys.length === 0) {
    return props;
  }

  const authDataStr = await env.OAUTH_KV.get(authEntries.keys[0].name);
  if (!authDataStr) {
    return props;
  }

  const authData = JSON.parse(authDataStr);
  if (!authData.authToken) {
    return props;
  }

  // Check JWT validity
  try {
    const isValid = await checkJWTValidity(authData.authToken, env.XANO_BASE_URL);
    
    if (!isValid) {
      // JWT expired - delete all tokens
      await deleteAllAuthTokens(env);
      // Return unauthenticated to trigger OAuth
      return { authenticated: false };
    }
    
    // JWT is valid - enhance props
    return {
      ...props,
      apiKey: authData.apiKey,
      lastRefreshed: authData.lastRefreshed
    };
  } catch (error) {
    // Network error - continue with existing auth
    console.error('Error checking JWT validity:', error);
    return props;
  }
};

describe('OAuth JWT Refresh Tests', () => {
  let mockEnv: any;

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

    // Reset fetch mock
    global.fetch = vi.fn();
  });

  describe('JWT Validity Checking', () => {
    it('should successfully check valid JWT', async () => {
      // Mock successful auth/me response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ api_key: 'test-api-key', id: 'user-123' })
      });

      const isValid = await checkJWTValidity('valid-jwt-token', mockEnv.XANO_BASE_URL);

      expect(isValid).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://xnwv-v1z6-dvnr.n7c.xano.io/api:e6emygx3/auth/me',
        {
          headers: {
            'Authorization': 'Bearer valid-jwt-token',
            'Content-Type': 'application/json'
          }
        }
      );
    });

    it('should detect expired JWT (401 response)', async () => {
      // Mock 401 response
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const isValid = await checkJWTValidity('expired-jwt-token', mockEnv.XANO_BASE_URL);

      expect(isValid).toBe(false);
    });

    it('should throw on network error', async () => {
      // Mock network error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(checkJWTValidity('some-token', mockEnv.XANO_BASE_URL))
        .rejects.toThrow('Network error');
    });
  });

  describe('Token Deletion', () => {
    it('should delete all auth tokens from KV storage', async () => {
      // Mock KV list responses
      mockEnv.OAUTH_KV.list.mockImplementation(async (opts: any) => {
        if (opts.prefix === 'token:') {
          return { keys: [{ name: 'token:abc' }, { name: 'token:def' }] };
        }
        if (opts.prefix === 'xano_auth_token:') {
          return { keys: [{ name: 'xano_auth_token:user-123' }] };
        }
        if (opts.prefix === 'refresh:') {
          return { keys: [{ name: 'refresh:ghi' }] };
        }
        return { keys: [] };
      });

      const deletedCount = await deleteAllAuthTokens(mockEnv);

      expect(deletedCount).toBe(4);
      expect(mockEnv.OAUTH_KV.delete).toHaveBeenCalledWith('token:abc');
      expect(mockEnv.OAUTH_KV.delete).toHaveBeenCalledWith('token:def');
      expect(mockEnv.OAUTH_KV.delete).toHaveBeenCalledWith('xano_auth_token:user-123');
      expect(mockEnv.OAUTH_KV.delete).toHaveBeenCalledWith('refresh:ghi');
    });

    it('should handle empty token lists', async () => {
      // Mock empty KV responses
      mockEnv.OAUTH_KV.list.mockResolvedValue({ keys: [] });

      const deletedCount = await deleteAllAuthTokens(mockEnv);

      expect(deletedCount).toBe(0);
      expect(mockEnv.OAUTH_KV.delete).not.toHaveBeenCalled();
    });
  });

  describe('Props Enhancement with JWT Check', () => {
    it('should detect expired JWT and force re-authentication', async () => {
      // Setup: authenticated props
      const props = {
        authenticated: true,
        userId: 'user-123',
        apiKey: 'old-api-key'
      };

      // Mock KV storage with auth token
      mockEnv.OAUTH_KV.list.mockImplementation(async (opts: any) => {
        if (opts.prefix === 'xano_auth_token:') {
          return { keys: [{ name: 'xano_auth_token:user-123' }] };
        }
        return { keys: [{ name: 'token:abc' }] };
      });

      mockEnv.OAUTH_KV.get.mockResolvedValue(JSON.stringify({
        userId: 'user-123',
        apiKey: 'api-key-123',
        authToken: 'expired-jwt-token'
      }));

      // Mock 401 response for auth/me
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401
      });

      const enhancedProps = await enhancePropsWithJWTCheck(props, mockEnv);

      // Should have deleted all tokens
      expect(mockEnv.OAUTH_KV.delete).toHaveBeenCalled();
      
      // Should return unauthenticated
      expect(enhancedProps).toEqual({ authenticated: false });
    });

    it('should enhance props when JWT is valid', async () => {
      const props = {
        authenticated: true,
        userId: 'user-123',
        apiKey: 'old-api-key'
      };

      // Mock KV storage
      mockEnv.OAUTH_KV.list.mockResolvedValue({
        keys: [{ name: 'xano_auth_token:user-123' }]
      });

      mockEnv.OAUTH_KV.get.mockResolvedValue(JSON.stringify({
        userId: 'user-123',
        apiKey: 'fresh-api-key',
        authToken: 'valid-jwt-token',
        lastRefreshed: '2024-01-01T00:00:00Z'
      }));

      // Mock successful auth/me
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      const enhancedProps = await enhancePropsWithJWTCheck(props, mockEnv);

      // Should NOT delete tokens
      expect(mockEnv.OAUTH_KV.delete).not.toHaveBeenCalled();
      
      // Should enhance props with fresh data
      expect(enhancedProps.authenticated).toBe(true);
      expect(enhancedProps.apiKey).toBe('fresh-api-key');
      expect(enhancedProps.lastRefreshed).toBe('2024-01-01T00:00:00Z');
    });

    it('should handle network errors gracefully', async () => {
      const props = {
        authenticated: true,
        userId: 'user-123',
        apiKey: 'existing-api-key'
      };

      // Mock KV storage
      mockEnv.OAUTH_KV.list.mockResolvedValue({
        keys: [{ name: 'xano_auth_token:user-123' }]
      });

      mockEnv.OAUTH_KV.get.mockResolvedValue(JSON.stringify({
        authToken: 'some-jwt-token'
      }));

      // Mock network error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const enhancedProps = await enhancePropsWithJWTCheck(props, mockEnv);

      // Should NOT delete tokens on network error
      expect(mockEnv.OAUTH_KV.delete).not.toHaveBeenCalled();
      
      // Should return original props
      expect(enhancedProps).toEqual(props);
    });

    it('should skip JWT check for unauthenticated requests', async () => {
      const props = { authenticated: false };

      const enhancedProps = await enhancePropsWithJWTCheck(props, mockEnv);

      // Should not make any KV or fetch calls
      expect(mockEnv.OAUTH_KV.list).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
      
      // Should return props unchanged
      expect(enhancedProps).toEqual(props);
    });
  });

  describe('OAuth Flow Control', () => {
    it('should force re-authentication by deleting all tokens', async () => {
      // This simulates the manual control you need
      mockEnv.OAUTH_KV.list.mockImplementation(async (opts: any) => {
        if (opts.prefix === 'token:') return { keys: [{ name: 'token:1' }] };
        if (opts.prefix === 'xano_auth_token:') return { keys: [{ name: 'xano_auth_token:1' }] };
        if (opts.prefix === 'refresh:') return { keys: [{ name: 'refresh:1' }] };
        return { keys: [] };
      });

      const deletedCount = await deleteAllAuthTokens(mockEnv);

      expect(deletedCount).toBe(3);
      expect(mockEnv.OAUTH_KV.delete).toHaveBeenCalledTimes(3);
      
      // Next request will have no tokens and trigger OAuth
    });

    it('should check JWT on every authenticated request', async () => {
      // Simulate multiple requests
      const props = { authenticated: true, userId: 'user-123' };
      
      mockEnv.OAUTH_KV.list.mockResolvedValue({
        keys: [{ name: 'xano_auth_token:user-123' }]
      });
      
      mockEnv.OAUTH_KV.get.mockResolvedValue(JSON.stringify({
        authToken: 'jwt-token'
      }));
      
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      // Multiple requests
      await enhancePropsWithJWTCheck(props, mockEnv);
      await enhancePropsWithJWTCheck(props, mockEnv);
      await enhancePropsWithJWTCheck(props, mockEnv);

      // JWT checked on each request
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });
});