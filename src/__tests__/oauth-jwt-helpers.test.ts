import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  checkJWTValidity, 
  deleteAllAuthTokens, 
  enhancePropsWithJWTCheck 
} from '../oauth-jwt-helpers';

describe('OAuth JWT Helpers Implementation', () => {
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

  describe('checkJWTValidity', () => {
    it('should return true for valid JWT', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      const result = await checkJWTValidity('valid-token', mockEnv.XANO_BASE_URL);
      
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://xnwv-v1z6-dvnr.n7c.xano.io/api:e6emygx3/auth/me',
        {
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json'
          }
        }
      );
    });

    it('should return false for expired JWT', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401
      });

      const result = await checkJWTValidity('expired-token', mockEnv.XANO_BASE_URL);
      
      expect(result).toBe(false);
    });

    it('should throw on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network failed'));

      await expect(checkJWTValidity('token', mockEnv.XANO_BASE_URL))
        .rejects.toThrow('Network failed');
    });
  });

  describe('deleteAllAuthTokens', () => {
    it('should delete all token types', async () => {
      mockEnv.OAUTH_KV.list.mockImplementation(async (opts: any) => {
        if (opts.prefix === 'token:') {
          return { keys: [{ name: 'token:1' }, { name: 'token:2' }] };
        }
        if (opts.prefix === 'xano_auth_token:') {
          return { keys: [{ name: 'xano_auth_token:1' }] };
        }
        if (opts.prefix === 'refresh:') {
          return { keys: [{ name: 'refresh:1' }] };
        }
        return { keys: [] };
      });

      const count = await deleteAllAuthTokens(mockEnv);

      expect(count).toBe(4);
      expect(mockEnv.OAUTH_KV.delete).toHaveBeenCalledTimes(4);
      expect(mockEnv.OAUTH_KV.delete).toHaveBeenCalledWith('token:1');
      expect(mockEnv.OAUTH_KV.delete).toHaveBeenCalledWith('token:2');
      expect(mockEnv.OAUTH_KV.delete).toHaveBeenCalledWith('xano_auth_token:1');
      expect(mockEnv.OAUTH_KV.delete).toHaveBeenCalledWith('refresh:1');
    });
  });

  describe('enhancePropsWithJWTCheck', () => {
    it('should return unauthenticated when JWT is expired', async () => {
      const props = { authenticated: true, userId: 'user-123' };
      
      mockEnv.OAUTH_KV.list.mockResolvedValue({
        keys: [{ name: 'xano_auth_token:user-123' }]
      });
      
      mockEnv.OAUTH_KV.get.mockResolvedValue(JSON.stringify({
        authToken: 'expired-token',
        apiKey: 'api-key',
        userId: 'user-123'
      }));
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401
      });

      const result = await enhancePropsWithJWTCheck(props, mockEnv);

      expect(result).toEqual({ authenticated: false });
      expect(mockEnv.OAUTH_KV.delete).toHaveBeenCalled();
    });

    it('should enhance props when JWT is valid', async () => {
      const props = { authenticated: true, userId: 'user-123' };
      
      mockEnv.OAUTH_KV.list.mockResolvedValue({
        keys: [{ name: 'xano_auth_token:user-123' }]
      });
      
      mockEnv.OAUTH_KV.get.mockResolvedValue(JSON.stringify({
        authToken: 'valid-token',
        apiKey: 'fresh-api-key',
        userId: 'user-123',
        lastRefreshed: '2024-01-01'
      }));
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      const result = await enhancePropsWithJWTCheck(props, mockEnv);

      expect(result.authenticated).toBe(true);
      expect(result.apiKey).toBe('fresh-api-key');
      expect(result.lastRefreshed).toBe('2024-01-01');
      expect(mockEnv.OAUTH_KV.delete).not.toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      const props = { authenticated: true, userId: 'user-123', apiKey: 'existing' };
      
      mockEnv.OAUTH_KV.list.mockResolvedValue({
        keys: [{ name: 'xano_auth_token:user-123' }]
      });
      
      mockEnv.OAUTH_KV.get.mockResolvedValue(JSON.stringify({
        authToken: 'some-token'
      }));
      
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await enhancePropsWithJWTCheck(props, mockEnv);

      expect(result).toEqual(props);
      expect(mockEnv.OAUTH_KV.delete).not.toHaveBeenCalled();
    });
  });
});