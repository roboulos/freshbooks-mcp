import { XanoClient } from '../xano';
import { z } from 'zod';

/**
 * Tool for creating new records in Xano database
 * @param xano Xano client instance
 * @param entity Entity to create in
 * @param data JSON data for the new record
 * @returns Created record information
 */
export async function createTool(
  xano: XanoClient,
  entity: string,
  data: string
) {
  try {
    // Parse data JSON
    const parsedData = JSON.parse(data);
    
    // Create record
    const result = await xano.create(entity, parsedData);
    
    // Format for MCP response
    return {
      content: [
        {
          type: 'text',
          text: `Successfully created new ${entity} record with ID: ${result.id}`
        },
        {
          type: 'json',
          json: result
        }
      ]
    };
  } catch (error) {
    console.error(`Create error for ${entity}:`, error);
    throw new Error(`Failed to create ${entity}: ${error.message}`);
  }
}

// Define schema for create tool parameters
export const createToolSchema = {
  entity: z.string().describe('The entity/table name to create in'),
  data: z.string().describe('JSON data for the new record')
};