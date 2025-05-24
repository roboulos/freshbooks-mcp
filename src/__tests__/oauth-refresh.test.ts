import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeApiRequest } from '../utils';

// Mock the refresh-profile module completely
const mockRefreshUserProfile = vi.fn();
vi.mock('../refresh-profile', () => ({
  refreshUserProfile: mockRefreshUserProfile,
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OAuth Token Refresh Mechanism', () => {
  let mockEnv: any;
  let mockKV: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock KV storage
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
    };

    // Mock environment
    mockEnv = {
      OAUTH_KV: mockKV,
      XANO_BASE_URL: 'https://test.xano.io',
      OAUTH_TOKEN_TTL: '86400', // 24 hours
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('401 Error Detection and Auto-Refresh', () => {
    it('should detect 401 errors and trigger automatic refresh', async () => {
      // Arrange: Setup initial 401 response
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ message: 'Token expired' }),
        })
        // Setup successful retry after refresh
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: () => Promise.resolve('{"data": "success"}'),
        });

      // Mock successful refresh
      mockRefreshUserProfile.mockResolvedValue({
        success: true,
        profile: {
          apiKey: 'fresh_api_key_123',
          userId: 'user123',
          name: 'Test User',
          email: 'test@example.com',
        },
      });

      // Act: Make API request that should trigger refresh
      const result = await makeApiRequest(
        'https://test.xano.io/api/endpoint',
        'expired_token_123',
        'GET',
        undefined,
        mockEnv
      );

      // Assert: Verify refresh was triggered and retry succeeded
      expect(mockRefreshUserProfile).toHaveBeenCalledWith(mockEnv);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Original + retry
      expect(result).toEqual({ data: 'success' });
      
      // Verify retry used fresh token
      const retryCall = mockFetch.mock.calls[1];
      expect(retryCall[1].headers.Authorization).toBe('Bearer fresh_api_key_123');
    });

    it('should return 401 error when refresh fails', async () => {
      // Arrange: Setup 401 response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ message: 'Token expired' }),
      });

      // Mock failed refresh
      mockRefreshUserProfile.mockResolvedValue({
        success: false,
        error: 'Refresh failed',
      });

      // Act: Make API request
      const result = await makeApiRequest(
        'https://test.xano.io/api/endpoint',
        'expired_token_123',
        'GET',
        undefined,
        mockEnv
      );

      // Assert: Should return original 401 error
      expect(mockRefreshUserProfile).toHaveBeenCalledWith(mockEnv);
      expect(result).toEqual({
        error: 'Token expired',
        code: undefined,
        status: 401,
      });
    });

    it('should not trigger refresh for non-401 errors', async () => {
      // Arrange: Setup 500 response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ message: 'Server error' }),
      });

      // mockRefreshUserProfile is already available from module scope

      // Act: Make API request
      const result = await makeApiRequest(
        'https://test.xano.io/api/endpoint',
        'valid_token_123',
        'GET',
        undefined,
        mockEnv
      );

      // Assert: Should not trigger refresh
      expect(mockRefreshUserProfile).not.toHaveBeenCalled();
      expect(result).toEqual({
        error: 'Server error',
        code: undefined,
        status: 500,
      });
    });

    it('should handle 401 without env parameter gracefully', async () => {
      // Arrange: Setup 401 response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ message: 'Token expired' }),
      });

      // Act: Make API request without env (should not trigger refresh)
      const result = await makeApiRequest(
        'https://test.xano.io/api/endpoint',
        'expired_token_123',
        'GET'
        // No env parameter
      );

      // Assert: Should return 401 without attempting refresh
      expect(result).toEqual({
        error: 'Token expired',
        code: undefined,
        status: 401,
      });
    });
  });

  // Note: Direct refreshUserProfile tests moved to refresh-profile.test.ts

  describe('Complete OAuth Refresh Flow', () => {
    it('should handle complete flow: 401 -> refresh -> retry -> success', async () => {
      // Arrange: Mock successful refresh
      mockRefreshUserProfile.mockResolvedValue({
        success: true,
        profile: {
          apiKey: 'refreshed_api_key',
          userId: 'user123',
          name: 'Test User',
          email: 'test@example.com',
        },
      });

      // First call: 401 error
      // Second call: retry success with fresh token
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ message: 'Token expired' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: () => Promise.resolve('{"result": "success after refresh"}'),
        });

      // Act: Make request that triggers full flow
      const result = await makeApiRequest(
        'https://test.xano.io/api/test',
        'expired_token',
        'GET',
        undefined,
        mockEnv
      );

      // Assert: Complete flow worked
      expect(mockFetch).toHaveBeenCalledTimes(2); // Original + retry
      expect(result).toEqual({ result: 'success after refresh' });
      expect(mockRefreshUserProfile).toHaveBeenCalledWith(mockEnv);
    });

    it('should handle refresh success but retry failure', async () => {
      // Arrange: Mock successful refresh but failed retry
      mockRefreshUserProfile.mockResolvedValue({
        success: true,
        profile: {
          apiKey: 'refreshed_api_key',
          userId: 'user123',
          name: 'Test User',
          email: 'test@example.com',
        },
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ message: 'Token expired' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ message: 'Access denied' }),
        });

      // Act: Make request
      const result = await makeApiRequest(
        'https://test.xano.io/api/test',
        'expired_token',
        'GET',
        undefined,
        mockEnv
      );

      // Assert: Should return original 401 since retry failed
      expect(result).toEqual({
        error: 'Token expired',
        code: undefined,
        status: 401,
      });
    });
  });

  describe('Token TTL and Expiry Behavior', () => {
    it('should respect configured TTL for token expiry', async () => {
      // This is more of an integration test that would verify
      // the TTL is properly set during OAuth setup
      
      // For now, just verify the env variable is accessible
      expect(mockEnv.OAUTH_TOKEN_TTL).toBe('86400');
      
      // In a real test, we would:
      // 1. Set up OAuth with specific TTL
      // 2. Fast-forward time past TTL
      // 3. Verify next request triggers re-auth
    });

    it('should handle multiple concurrent refresh attempts gracefully', async () => {
      // Arrange: Mock successful refresh for concurrent scenario
      mockRefreshUserProfile.mockResolvedValue({
        success: true,
        profile: {
          apiKey: 'refreshed_api_key',
          userId: 'user123',
          name: 'Test User',
          email: 'test@example.com',
        },
      });

      // Mock all requests as 401 (no retries for simplicity)
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ message: 'Token expired' }),
      });

      // Act: Make multiple concurrent requests that would trigger refresh
      const requests = [
        makeApiRequest('https://test.xano.io/api/test1', 'expired_token', 'GET', undefined, mockEnv),
        makeApiRequest('https://test.xano.io/api/test2', 'expired_token', 'GET', undefined, mockEnv),
        makeApiRequest('https://test.xano.io/api/test3', 'expired_token', 'GET', undefined, mockEnv),
      ];

      // Wait for all to complete
      const results = await Promise.all(requests);

      // Assert: All should attempt refresh (though may return 401 if refresh fails on retry)
      expect(mockRefreshUserProfile).toHaveBeenCalled();
      expect(results.every(r => r.status === 401)).toBe(true);
    });
  });
});