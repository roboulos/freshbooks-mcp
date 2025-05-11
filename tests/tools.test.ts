import { searchTool } from '../src/tools/searchTool';
import { createTool } from '../src/tools/createTool';

// Mock XanoClient
const mockXanoClient = {
  search: jest.fn(),
  create: jest.fn()
} as any;

describe('Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchTool', () => {
    test('formats search results correctly', async () => {
      // Mock search results
      const mockResults = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ];
      mockXanoClient.search.mockResolvedValue(mockResults);
      
      // Call the search tool
      const result = await searchTool(
        mockXanoClient,
        'items',
        'test query',
        '{"status":"active"}'
      );
      
      // Check the XanoClient was called correctly
      expect(mockXanoClient.search).toHaveBeenCalledWith(
        'items',
        'test query',
        { status: 'active' }
      );
      
      // Check the result format
      expect(result.content).toHaveLength(2);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Found 2 results');
      expect(result.content[1].type).toBe('json');
      expect(result.content[1].json).toEqual(mockResults);
    });
    
    test('handles errors correctly', async () => {
      // Mock error response
      mockXanoClient.search.mockRejectedValue(new Error('API error'));
      
      // Call the search tool and check error handling
      await expect(searchTool(
        mockXanoClient,
        'items',
        'test query'
      )).rejects.toThrow('Failed to search items');
    });
  });
  
  describe('createTool', () => {
    test('formats creation result correctly', async () => {
      // Mock create result
      const mockResult = { id: 123, name: 'New Item' };
      mockXanoClient.create.mockResolvedValue(mockResult);
      
      // Call the create tool
      const result = await createTool(
        mockXanoClient,
        'items',
        '{"name":"New Item"}'
      );
      
      // Check the XanoClient was called correctly
      expect(mockXanoClient.create).toHaveBeenCalledWith(
        'items',
        { name: 'New Item' }
      );
      
      // Check the result format
      expect(result.content).toHaveLength(2);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Successfully created');
      expect(result.content[1].type).toBe('json');
      expect(result.content[1].json).toEqual(mockResult);
    });
    
    test('handles errors correctly', async () => {
      // Mock error response
      mockXanoClient.create.mockRejectedValue(new Error('API error'));
      
      // Call the create tool and check error handling
      await expect(createTool(
        mockXanoClient,
        'items',
        '{"name":"New Item"}'
      )).rejects.toThrow('Failed to create items');
    });
  });
});