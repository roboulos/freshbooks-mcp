# Cloudflare Workers MCP Server for Xano

A Model Context Protocol (MCP) server built with Cloudflare Workers that connects AI assistants with Xano backend services.

## Features

- Implements both Streamable HTTP and SSE protocols for maximum compatibility
- Integrates with Xano backend for authentication and tool discovery
- Manages state using Durable Objects
- Handles errors gracefully
- Follows security best practices

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a KV namespace:
   ```
   npx wrangler kv:namespace create AUTH_TOKENS
   ```
4. Update the `wrangler.toml` file with your KV namespace ID
5. Update the `.dev.vars` file with your Xano credentials

## Development

Run the server locally:
```
npm run dev
```

## Deployment

1. Create a production KV namespace:
   ```
   npx wrangler kv:namespace create AUTH_TOKENS --env production
   ```
2. Set up secrets:
   ```
   npx wrangler secret put XANO_CLIENT_ID --env production
   npx wrangler secret put XANO_CLIENT_SECRET --env production
   ```
3. Deploy to Cloudflare Workers:
   ```
   npm run deploy
   ```

## Usage

### Claude Desktop
Edit your Claude Desktop configuration to include:
```json
{
  "mcpServers": {
    "xano-mcp-server": {
      "command": "npx",
      "args": ["mcp-remote", "https://xano-mcp-server.<your-subdomain>.workers.dev/sse"]
    }
  }
}
```

### Cloudflare AI Playground
- Navigate to the AI Playground
- Enter your MCP server URL: `https://xano-mcp-server.<your-subdomain>.workers.dev/mcp`# cloudflare-mcp-server
