import { Env } from './types/env';
import { XanoMcpServer } from './server';
import { SessionObject } from './sessionObject';

/**
 * Handles all incoming requests to the Worker
 */
export default {
  /**
   * Handle fetch events
   * @param request Incoming request
   * @param env Environment variables and bindings
   * @param ctx Execution context
   * @returns Response
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Connection-Id',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    try {
      // Create and initialize the MCP server
      const mcpServer = new XanoMcpServer(env);
      await mcpServer.init();

      // Handle the request
      return mcpServer.fetch(request, env, ctx);
    } catch (error) {
      console.error('Error handling request:', error);

      // Return a formatted error response
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};

// Export Durable Object class
export { SessionObject };