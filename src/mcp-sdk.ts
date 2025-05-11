// Import the SDK modules with the correct paths
import { Server } from '@modelcontextprotocol/sdk/dist/server/index.js';
import { SseServerTransport } from '@modelcontextprotocol/sdk/dist/server/sse.js';

// Re-export the components we need
export const McpServer = Server;
export { SseServerTransport };

// Create a custom Streamable HTTP transport since it's not in the SDK
export class StreamableHTTPServerTransport {
  private server: any;
  
  async connect(server: any) {
    this.server = server;
  }
  
  async handleJsonRpcRequest(body: any, writer?: any) {
    if (!writer) {
      // Non-streaming mode
      return this.server.handleJsonRpcMessage(body);
    } else {
      // Streaming mode
      const encoder = new TextEncoder();
      
      try {
        const cb = (event: any) => {
          writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };
        
        // Add progress callback
        this.server.on('progress', cb);
        
        // Handle the request
        const result = await this.server.handleJsonRpcMessage(body);
        
        // Send result if needed
        if (result) {
          writer.write(encoder.encode(`data: ${JSON.stringify(result)}\n\n`));
        }
        
        // Remove callback
        this.server.off('progress', cb);
      } catch (error) {
        console.error('Error handling streaming request:', error);
        // Send error response
        const errorResponse = {
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: error.message
          },
          id: body.id || null
        };
        writer.write(encoder.encode(`data: ${JSON.stringify(errorResponse)}\n\n`));
      }
    }
  }
}