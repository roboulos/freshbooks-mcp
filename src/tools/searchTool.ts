import { XanoClient } from '../xano';
import { z } from 'zod';

/**
 * Tool for searching records in Xano database
 * @param xano Xano client instance
 * @param entity Entity to search
 * @param query Search query
 * @param filters Optional JSON filters
 * @returns Search results formatted for MCP
 */
export async function searchTool(
  xano: XanoClient,
  entity: string,
  query: string,
  filters: string = '{}'
) {
  try {
    // Parse filters if provided
    const parsedFilters = JSON.parse(filters);
    
    // Perform search
    const results = await xano.search(entity, query, parsedFilters);
    
    // Format for MCP response
    return {
      content: [
        {
          type: 'text',
          text: `Found ${results.length} results for "${query}" in ${entity}`
        },
        {
          type: 'json',
          json: results
        }
      ]
    };
  } catch (error) {
    console.error(`Search error for ${entity}:`, error);
    throw new Error(`Failed to search ${entity}: ${error.message}`);
  }
}

// Define schema for search tool parameters
export const searchToolSchema = {
  entity: z.string().describe('The entity/table name to search in'),
  query: z.string().describe('Search query string'),
  filters: z.string().optional().describe('Optional JSON filters in Xano format')
};