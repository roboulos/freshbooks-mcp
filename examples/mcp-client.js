#!/usr/bin/env node

/**
 * Simple MCP client example for testing your Xano MCP server
 */
const { McpClient } = require('@modelcontextprotocol/sdk/client/mcp');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/transport/streamable-http');

// Configuration
const SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:8787/mcp';

// Create MCP client
async function createClient() {
  // Create the transport
  const transport = new StreamableHTTPClientTransport();
  await transport.connect(SERVER_URL);
  
  // Create the client
  const client = new McpClient();
  await client.connect(transport);
  
  return client;
}

// Initialize client and list tools
async function main() {
  try {
    console.log(`Connecting to MCP server at: ${SERVER_URL}`);
    
    const client = await createClient();
    console.log('Connected to MCP server!');
    
    // Get server info
    const serverInfo = client.getServerInfo();
    console.log('Server Info:', JSON.stringify(serverInfo, null, 2));
    
    // List available tools
    console.log('Listing available tools...');
    const tools = await client.listTools();
    
    console.log(`\nAvailable tools (${tools.length}):`);
    for (const tool of tools) {
      console.log(`- ${tool.name}: ${tool.description}`);
      console.log('  Parameters:', JSON.stringify(tool.parameters, null, 2));
      console.log('');
    }
    
    // Test a tool if arguments provided
    if (process.argv.length > 2) {
      const toolName = process.argv[2];
      const toolArgs = process.argv.length > 3 ? JSON.parse(process.argv[3]) : {};
      
      console.log(`\nExecuting tool "${toolName}" with args:`, JSON.stringify(toolArgs, null, 2));
      
      const result = await client.callTool(toolName, toolArgs);
      console.log('\nResult:', JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the client
main();

/**
 * Usage examples:
 * 
 * List all tools:
 * node mcp-client.js
 * 
 * Execute the search tool:
 * node mcp-client.js search '{"entity":"users","query":"John"}'
 * 
 * Execute the create tool:
 * node mcp-client.js create '{"entity":"users","data":"{\"name\":\"John Doe\",\"email\":\"john@example.com\"}"}'
 */