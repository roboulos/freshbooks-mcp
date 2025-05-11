/**
 * Simple MCP server using Cloudflare Workers
 */

// Simple request handler
export default {
  async fetch(request, env, ctx) {
    return new Response('MCP Server is ready for your instructions!', {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  },
};