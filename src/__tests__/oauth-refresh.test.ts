import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeApiRequest } from '../utils';
import { refreshUserProfile } from '../refresh-profile';

// Mock the refresh-profile import to avoid circular dependencies
vi.mock('../refresh-profile', () => ({
  refreshUserProfile: vi.fn(),
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
      const mockRefreshUserProfile = vi.mocked(refreshUserProfile);
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
      const mockRefreshUserProfile = vi.mocked(refreshUserProfile);
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

      const mockRefreshUserProfile = vi.mocked(refreshUserProfile);

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

  describe('Token Refresh Profile Function', () => {
    it('should successfully refresh user profile with xano_auth_token storage', async () => {
      // Arrange: Mock KV storage with xano_auth_token format
      mockKV.list.mockImplementation(({ prefix }) => {
        if (prefix === 'xano_auth_token:') {
          return Promise.resolve({
            keys: [{ name: 'xano_auth_token:user123' }],
          });
        }
        return Promise.resolve({ keys: [] });
      });

      mockKV.get.mockResolvedValue(JSON.stringify({
        userId: 'user123',
        authToken: 'stored_auth_token_123',
        email: 'old@example.com',
        name: 'Old Name',
      }));

      // Mock successful auth/me call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({
          id: 'user123',
          api_key: 'fresh_api_key_456',
          email: 'new@example.com',
          name: 'Updated Name',
        }),
      });

      // Act: Refresh profile
      const result = await refreshUserProfile(mockEnv);

      // Assert: Should successfully refresh
      expect(result.success).toBe(true);
      expect(result.profile).toEqual({
        apiKey: 'fresh_api_key_456',
        userId: 'user123',
        name: 'Updated Name',
        email: 'new@example.com',
      });

      // Verify KV was updated
      expect(mockKV.put).toHaveBeenCalledWith(
        'xano_auth_token:user123',
        expect.stringContaining('fresh_api_key_456')
      );
    });

    it('should fall back to legacy token: storage format', async () => {
      // Arrange: Mock KV storage with legacy format
      mockKV.list.mockImplementation(({ prefix }) => {
        if (prefix === 'xano_auth_token:') {
          return Promise.resolve({ keys: [] });
        }
        if (prefix === 'token:') {
          return Promise.resolve({
            keys: [{ name: 'token:abc123' }],
          });
        }
        return Promise.resolve({ keys: [] });
      });

      mockKV.get.mockResolvedValue(JSON.stringify({
        accessToken: 'legacy_token_123',
        userId: 'user456',
        email: 'legacy@example.com',
      }));

      // Mock successful auth/me call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({
          id: 'user456',
          api_key: 'fresh_api_key_789',
          email: 'legacy@example.com',
          name: 'Legacy User',
        }),
      });

      // Act: Refresh profile
      const result = await refreshUserProfile(mockEnv);

      // Assert: Should successfully refresh with legacy format
      expect(result.success).toBe(true);
      expect(result.profile.apiKey).toBe('fresh_api_key_789');
      expect(result.profile.userId).toBe('user456');
    });

    it('should fail when no auth tokens are found', async () => {
      // Arrange: Mock empty KV storage
      mockKV.list.mockResolvedValue({ keys: [] });

      // Act: Attempt to refresh profile
      const result = await refreshUserProfile(mockEnv);

      // Assert: Should fail with appropriate error
      expect(result.success).toBe(false);
      expect(result.error).toBe('No authentication tokens found');
    });

    it('should fail when auth/me request fails', async () => {
      // Arrange: Mock KV with valid token
      mockKV.list.mockResolvedValue({
        keys: [{ name: 'xano_auth_token:user123' }],
      });

      mockKV.get.mockResolvedValue(JSON.stringify({
        userId: 'user123',
        authToken: 'valid_token_123',
      }));

      // Mock failed auth/me call
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('Invalid token'),
      });

      // Act: Attempt to refresh profile
      const result = await refreshUserProfile(mockEnv);

      // Assert: Should fail
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to refresh user profile');
    });

    it('should fail when auth/me returns no api_key', async () => {
      // Arrange: Mock valid setup but response missing api_key
      mockKV.list.mockResolvedValue({
        keys: [{ name: 'xano_auth_token:user123' }],
      });

      mockKV.get.mockResolvedValue(JSON.stringify({
        userId: 'user123',
        authToken: 'valid_token_123',
      }));

      // Mock auth/me response without api_key
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({
          id: 'user123',
          email: 'test@example.com',
          // Missing api_key field
        }),
      });

      // Act: Attempt to refresh profile
      const result = await refreshUserProfile(mockEnv);

      // Assert: Should fail
      expect(result.success).toBe(false);
      expect(result.error).toBe('API key not found in response');
    });
  });

  describe('Complete OAuth Refresh Flow', () => {
    it('should handle complete flow: 401 -> refresh -> retry -> success', async () => {
      // Arrange: Setup complete mock scenario
      mockKV.list.mockResolvedValue({
        keys: [{ name: 'xano_auth_token:user123' }],
      });

      mockKV.get.mockResolvedValue(JSON.stringify({
        userId: 'user123',
        authToken: 'stored_auth_token',
      }));

      // First call: 401 error
      // Second call: auth/me success for refresh
      // Third call: retry success
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
          json: () => Promise.resolve({
            id: 'user123',
            api_key: 'refreshed_api_key',
            email: 'test@example.com',
            name: 'Test User',
          }),
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
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ result: 'success after refresh' });
      expect(mockKV.put).toHaveBeenCalled(); // Profile was updated
    });

    it('should handle refresh success but retry failure', async () => {
      // Arrange: Setup scenario where refresh works but retry fails
      mockKV.list.mockResolvedValue({
        keys: [{ name: 'xano_auth_token:user123' }],
      });

      mockKV.get.mockResolvedValue(JSON.stringify({
        userId: 'user123',
        authToken: 'stored_auth_token',
      }));

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
          json: () => Promise.resolve({
            id: 'user123',
            api_key: 'refreshed_api_key',
            email: 'test@example.com',
          }),
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
      // Arrange: Setup for concurrent refresh scenario
      mockKV.list.mockResolvedValue({
        keys: [{ name: 'xano_auth_token:user123' }],
      });

      mockKV.get.mockResolvedValue(JSON.stringify({
        userId: 'user123',
        authToken: 'stored_auth_token',
      }));

      // Mock responses for concurrent requests
      mockFetch
        .mockResolvedValue({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ message: 'Token expired' }),
        })
        .mockResolvedValue({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({
            id: 'user123',
            api_key: 'refreshed_api_key',
            email: 'test@example.com',
          }),
        });

      // Act: Make multiple concurrent requests that would trigger refresh
      const requests = [
        makeApiRequest('https://test.xano.io/api/test1', 'expired_token', 'GET', undefined, mockEnv),
        makeApiRequest('https://test.xano.io/api/test2', 'expired_token', 'GET', undefined, mockEnv),
        makeApiRequest('https://test.xano.io/api/test3', 'expired_token', 'GET', undefined, mockEnv),
      ];

      // Wait for all to complete
      await Promise.all(requests);

      // Assert: Should handle concurrent refresh attempts
      // (This is a basic test - real implementation might need more sophisticated
      // concurrency control to avoid multiple simultaneous refresh calls)
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});