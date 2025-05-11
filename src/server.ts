import { McpServer, SseServerTransport, StreamableHTTPServerTransport } from './mcp-sdk';
import { Env } from './types/env';
import { XanoClient } from './xano';
import { registerTools, registerDynamicTools } from './tools';

/**
 * Handler for MCP server routing and responses
 */
export class XanoMcpServer {
  server: McpServer;
  xanoClient: XanoClient;
  env: Env;
  router: Map<string, (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>>;
  sseConnections: Map<string, any>;
  
  constructor(env: Env) {
    this.env = env;
    this.xanoClient = new XanoClient(env);
    this.server = new McpServer({
      name: 'Xano MCP Server',
      version: '1.0.0',
      description: 'MCP server that connects to Xano backend'
    });
    this.router = new Map();
    this.sseConnections = new Map();
  }
  
  /**
   * Initialize the MCP server
   */
  async init() {
    console.log('Initializing Xano MCP Server');
    
    // Register all tools
    registerTools(this.server, this.xanoClient);
    
    // Register dynamic tools from Xano
    try {
      await registerDynamicTools(this.server, this.xanoClient);
    } catch (error) {
      console.error('Error registering dynamic tools:', error);
      // Continue without dynamic tools - don't fail initialization
    }
    
    // Set up SSE endpoint for Claude Desktop
    this.setupSseEndpoint();
    
    // Set up Streamable HTTP endpoint for Cloudflare AI Playground
    this.setupStreamableHttpEndpoint();
    
    console.log('Xano MCP Server initialized');
  }
  
  /**
   * Set up the SSE protocol endpoint
   */
  private setupSseEndpoint() {
    // Handle SSE connections
    this.router.set('GET@/sse', async (request, env, ctx) => {
      // Set up SSE connection headers
      const headers = new Headers({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      
      // Create streaming response
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      
      // Set up SSE transport
      const transport = new SseServerTransport();
      await transport.connect(this.server);
      
      // Generate a unique connection ID
      const connectionId = crypto.randomUUID();
      this.sseConnections.set(connectionId, { transport, writer });
      
      // Handle the connection in background
      ctx.waitUntil((async () => {
        try {
          await transport.handleConnection(writer);
        } catch (error) {
          console.error('SSE connection error:', error);
        } finally {
          this.sseConnections.delete(connectionId);
          await writer.close();
        }
      })());
      
      return new Response(readable, { headers });
    });
    
    // Handle SSE messages
    this.router.set('POST@/sse/messages', async (request, env, ctx) => {
      try {
        const message = await request.json();
        const connectionId = request.headers.get('X-Connection-Id');
        
        if (!connectionId || !this.sseConnections.has(connectionId)) {
          return new Response(JSON.stringify({
            error: 'Invalid or expired connection'
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
        
        const { transport } = this.sseConnections.get(connectionId);
        const result = await transport.receiveMessage(message);
        
        return new Response(JSON.stringify(result), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (error) {
        console.error('Error handling SSE message:', error);
        return new Response(JSON.stringify({
          error: 'Error processing message',
          message: error.message
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    });
  }
  
  /**
   * Set up the Streamable HTTP protocol endpoint
   */
  private setupStreamableHttpEndpoint() {
    this.router.set('POST@/mcp', async (request, env, ctx) => {
      try {
        const body = await request.json();
        
        // Process the request through MCP protocol
        const transport = new StreamableHTTPServerTransport();
        await transport.connect(this.server);
        
        // Determine if we should stream the response
        const shouldStream = body.params && 
          (body.method === 'tools/call' || body.method === 'tools/stream');
        
        if (shouldStream) {
          // For streaming responses, upgrade to SSE
          const { readable, writable } = new TransformStream();
          const writer = writable.getWriter();
          
          // Process the request and stream the response
          ctx.waitUntil((async () => {
            try {
              await transport.handleJsonRpcRequest(body, writer);
            } catch (error) {
              console.error('Streaming request error:', error);
            } finally {
              await writer.close();
            }
          })());
          
          return new Response(readable, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'Access-Control-Allow-Origin': '*'
            }
          });
        } else {
          // For non-streaming responses, return a standard JSON-RPC response
          const result = await transport.handleJsonRpcRequest(body);
          return new Response(JSON.stringify(result), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      } catch (error) {
        console.error('Error handling streamable HTTP request:', error);
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: error.message
          },
          id: null
        }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    });
  }
  
  /**
   * Handle incoming requests
   * @param request Incoming request
   * @param env Environment variables and bindings
   * @param ctx Execution context
   * @returns Response
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const routeKey = `${method}@${path}`;
    
    // Check if we have a handler for this route
    if (this.router.has(routeKey)) {
      const handler = this.router.get(routeKey);
      return handler(request, env, ctx);
    }
    
    // Handle CORS preflight for all routes
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Connection-Id',
          'Access-Control-Max-Age': '86400'
        }
      });
    }
    
    // Return 404 for unknown routes
    return new Response(JSON.stringify({
      error: 'Not found',
      message: `Route ${method} ${path} not found`
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}