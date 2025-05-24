import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { refreshUserProfile } from '../refresh-profile';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('RefreshUserProfile Function', () => {
  let mockEnv: any;
  let mockKV: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
    };

    mockEnv = {
      OAUTH_KV: mockKV,
      XANO_BASE_URL: 'https://test.xano.io',
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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
      expect.stringContaining('fresh_api_key_456'),
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