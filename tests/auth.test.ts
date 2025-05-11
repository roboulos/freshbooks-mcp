import { XanoAuth } from '../src/auth';

// Mock environment
const mockEnv = {
  XANO_API_BASE: 'https://example.com/api',
  XANO_CLIENT_ID: 'test-client-id',
  XANO_CLIENT_SECRET: 'test-client-secret',
  AUTH_TOKENS: {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  }
} as any;

// Mock fetch
global.fetch = jest.fn();

describe('XanoAuth', () => {
  let auth: XanoAuth;

  beforeEach(() => {
    auth = new XanoAuth(mockEnv);
    jest.clearAllMocks();
  });

  test('gets token from cache when available', async () => {
    // Set up a cached token
    (auth as any).token = 'cached-token';
    (auth as any).tokenExpiry = Date.now() + 1000000; // Far in the future
    
    const token = await auth.getToken();
    
    expect(token).toBe('cached-token');
    expect(mockEnv.AUTH_TOKENS.get).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('gets token from KV when available and cache is empty', async () => {
    // Set up KV token
    mockEnv.AUTH_TOKENS.get.mockImplementation((key) => {
      if (key === 'xano_token') return 'stored-token';
      if (key === 'xano_expiry') return (Date.now() + 1000000).toString(); // Far in the future
      return null;
    });
    
    const token = await auth.getToken();
    
    expect(token).toBe('stored-token');
    expect(mockEnv.AUTH_TOKENS.get).toHaveBeenCalledTimes(2);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('refreshes token when needed', async () => {
    // No cached token, no stored token
    mockEnv.AUTH_TOKENS.get.mockResolvedValue(null);
    
    // Mock successful token request
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'new-token', expires_in: 3600 })
    });
    
    const token = await auth.getToken();
    
    expect(token).toBe('new-token');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/api/auth/token',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String)
      })
    );
    expect(mockEnv.AUTH_TOKENS.put).toHaveBeenCalledWith('xano_token', 'new-token');
    expect(mockEnv.AUTH_TOKENS.put).toHaveBeenCalledWith('xano_expiry', expect.any(String));
  });

  test('handles token refresh errors', async () => {
    // No cached token, no stored token
    mockEnv.AUTH_TOKENS.get.mockResolvedValue(null);
    
    // Mock failed token request
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized'
    });
    
    await expect(auth.getToken()).rejects.toThrow('Failed to authenticate with Xano');
  });

  test('validates token correctly', async () => {
    // Mock successful validation
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true
    });
    
    const isValid = await auth.validateToken('test-token');
    
    expect(isValid).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/api/auth/validate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token'
        })
      })
    );
  });

  test('handles validation errors', async () => {
    // Mock failed validation
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false
    });
    
    const isValid = await auth.validateToken('test-token');
    
    expect(isValid).toBe(false);
  });
});