import { XanoMcpServer } from '../src/server';

// Mock environment
const mockEnv = {
  XANO_API_BASE: 'https://example.com/api',
  XANO_CLIENT_ID: 'test-client-id',
  XANO_CLIENT_SECRET: 'test-client-secret',
  AUTH_TOKENS: {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  SESSIONS: {
    newUniqueId: jest.fn(),
    get: jest.fn(),
  }
} as any;

// Mock fetch
global.fetch = jest.fn();
(global.fetch as jest.Mock).mockImplementation(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ token: 'test-token', expires_in: 3600 })
  })
);

describe('XanoMcpServer', () => {
  let server: XanoMcpServer;

  beforeEach(() => {
    server = new XanoMcpServer(mockEnv);
    jest.clearAllMocks();
  });

  test('initializes correctly', async () => {
    // Mock the router set function
    server.router.set = jest.fn();
    
    await server.init();
    
    // Should set up both endpoints
    expect(server.router.set).toHaveBeenCalledWith('GET@/sse', expect.any(Function));
    expect(server.router.set).toHaveBeenCalledWith('POST@/sse/messages', expect.any(Function));
    expect(server.router.set).toHaveBeenCalledWith('POST@/mcp', expect.any(Function));
  });

  test('handles CORS preflight requests', async () => {
    const request = new Request('https://example.com', { 
      method: 'OPTIONS' 
    });
    const ctx = { waitUntil: jest.fn() } as any;
    
    const response = await server.fetch(request, mockEnv, ctx);
    
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  test('handles 404 for unknown routes', async () => {
    const request = new Request('https://example.com/unknown', { 
      method: 'GET' 
    });
    const ctx = { waitUntil: jest.fn() } as any;
    
    const response = await server.fetch(request, mockEnv, ctx);
    
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Not found');
  });
});