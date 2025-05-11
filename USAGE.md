# Using the Xano MCP Server

This document provides examples of how to use your Xano MCP server with both Claude Desktop and Cloudflare AI Playground.

## Table of Contents

- [Setup with Claude Desktop](#setup-with-claude-desktop)
- [Setup with Cloudflare AI Playground](#setup-with-cloudflare-ai-playground)
- [Using the Search Tool](#using-the-search-tool)
- [Using the Create Tool](#using-the-create-tool)
- [Using Dynamic Xano Tools](#using-dynamic-xano-tools)
- [Troubleshooting](#troubleshooting)

## Setup with Claude Desktop

### Configuration

1. Edit your Claude Desktop configuration file (usually `~/.claude.json`):

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

2. Restart Claude Desktop to apply the changes

### Checking Connection

You can verify that Claude can connect to your MCP server by asking:

```
Can you list all the tools available from the Xano MCP server?
```

Claude should respond with a list of available tools, including:
- search - Search for records in a Xano database
- create - Create a new record in a Xano database
- Any dynamically registered tools from Xano

## Setup with Cloudflare AI Playground

1. Navigate to the AI Playground: https://ai.cloudflare.com/
2. Enter your MCP server URL: `https://xano-mcp-server.<your-subdomain>.workers.dev/mcp`
3. Start a conversation with the AI assistant
4. The assistant should have access to your Xano tools automatically

## Using the Search Tool

### Example 1: Basic Search

```
Can you search for users with the name "John" in the users table?
```

Claude will use the search tool like this:

```javascript
// Claude's tool execution (not visible to user)
search({
  entity: "users", 
  query: "John"
})
```

### Example 2: Search with Filters

```
Can you search for active products priced under $50 in the products table?
```

Claude will use the search tool with filters:

```javascript
// Claude's tool execution (not visible to user)
search({
  entity: "products", 
  query: "active", 
  filters: "{\"price\":{\"$lt\":50}}"
})
```

## Using the Create Tool

### Example 1: Creating a User

```
Create a new user in the users table with the following information:
- Name: Jane Smith
- Email: jane.smith@example.com
- Role: customer
```

Claude will use the create tool like this:

```javascript
// Claude's tool execution (not visible to user)
create({
  entity: "users",
  data: "{\"name\":\"Jane Smith\",\"email\":\"jane.smith@example.com\",\"role\":\"customer\"}"
})
```

### Example 2: Creating a Complex Record

```
Create a new order with the following details:
- Customer ID: 12345
- Products: [
  {id: 101, quantity: 2, price: 29.99},
  {id: 203, quantity: 1, price: 59.99}
]
- Shipping address: 123 Main St, Anytown, CA 12345
- Payment method: credit_card
```

Claude will use the create tool like this:

```javascript
// Claude's tool execution (not visible to user)
create({
  entity: "orders",
  data: "{\"customer_id\":12345,\"products\":[{\"id\":101,\"quantity\":2,\"price\":29.99},{\"id\":203,\"quantity\":1,\"price\":59.99}],\"shipping_address\":\"123 Main St, Anytown, CA 12345\",\"payment_method\":\"credit_card\"}"
})
```

## Using Dynamic Xano Tools

If you've set up dynamic tool registration from Xano, you can also use any function defined in your Xano instance. For example:

```
Can you get the sales summary for Q2 2023?
```

Claude might use a dynamically registered Xano function:

```javascript
// Claude's tool execution (not visible to user)
getSalesSummary({
  startDate: "2023-04-01",
  endDate: "2023-06-30"
})
```

## Troubleshooting

### Connection Issues

If Claude cannot connect to your MCP server:

1. Check that your worker is deployed correctly
   ```
   npx wrangler tail
   ```

2. Verify that the URL in your Claude configuration is correct

3. Check for errors in the worker logs:
   ```
   npx wrangler tail --format pretty
   ```

### Authentication Issues

If you see authentication errors:

1. Verify your Xano client credentials in `.dev.vars` (local) or using Wrangler secrets (production)

2. Check that your Xano API URL is correct in `wrangler.toml`

3. Try refreshing the token manually:
   ```
   curl -X POST https://xano-mcp-server.<your-subdomain>.workers.dev/refresh-token
   ```

### Tool Execution Issues

If tools aren't working correctly:

1. Check the format of your request parameters
2. Verify that the entity names match exactly what's in your Xano database
3. Make sure your JSON data is properly formatted for create operations
4. Check the worker logs for specific error messages