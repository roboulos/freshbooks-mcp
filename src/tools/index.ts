import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { XanoClient } from '../xano';
import { searchTool, searchToolSchema } from './searchTool';
import { createTool, createToolSchema } from './createTool';

/**
 * Register all tools with the MCP server
 * @param server MCP server instance
 * @param xano Xano client
 */
export function registerTools(server: McpServer, xano: XanoClient) {
  // Register search tool
  server.tool(
    'search',
    'Search for records in a Xano database',
    searchToolSchema,
    async ({ entity, query, filters }) => {
      return searchTool(xano, entity, query, filters);
    }
  );
  
  // Register create tool
  server.tool(
    'create',
    'Create a new record in a Xano database',
    createToolSchema,
    async ({ entity, data }) => {
      return createTool(xano, entity, data);
    }
  );
}

/**
 * Dynamically register tools from Xano functions
 * @param server MCP server instance
 * @param xano Xano client
 */
export async function registerDynamicTools(server: McpServer, xano: XanoClient) {
  try {
    // Fetch available functions from Xano
    const functions = await xano.getFunctions();
    
    // Register each function as an MCP tool
    for (const func of functions) {
      // Convert Xano parameters to Zod schema
      const schema = {};
      
      for (const param of func.parameters) {
        // Map Xano types to Zod types
        let zodType;
        switch (param.type) {
          case 'text':
            zodType = z.string();
            break;
          case 'number':
            zodType = z.number();
            break;
          case 'boolean':
            zodType = z.boolean();
            break;
          case 'object':
            zodType = z.record(z.any());
            break;
          case 'array':
            zodType = z.array(z.any());
            break;
          default:
            zodType = z.string();
        }
        
        // Add description
        zodType = zodType.describe(param.description || param.name);
        
        // Make optional if not required
        if (!param.required) {
          zodType = zodType.optional();
        }
        
        schema[param.name] = zodType;
      }
      
      // Register the tool
      server.tool(
        func.name,
        func.description || `Xano function: ${func.name}`,
        schema,
        async (params) => {
          try {
            // Call the Xano function
            const result = await xano.callFunction(func.name, params);
            
            // Format the response for MCP
            return {
              content: [
                {
                  type: 'json',
                  json: result
                }
              ]
            };
          } catch (error) {
            console.error(`Error calling Xano function ${func.name}:`, error);
            throw new Error(`Failed to call ${func.name}: ${error.message}`);
          }
        }
      );
      
      console.log(`Registered Xano function as tool: ${func.name}`);
    }
  } catch (error) {
    console.error('Error registering dynamic tools:', error);
    throw error;
  }
}