# MCP OAuth Template

A production-ready template for building Model Context Protocol (MCP) servers with OAuth authentication on Cloudflare Workers.

## 🎯 What is this?

This template provides a complete foundation for building MCP tools with:
- 🔐 **OAuth Authentication** - Secure user login with session persistence
- 📚 **Educational Examples** - 6 well-documented tool patterns to learn from
- 🚀 **Production Ready** - Includes security fixes and error handling
- ☁️ **Cloudflare Workers** - Serverless deployment with Durable Objects
- 🔄 **Auto Token Refresh** - Handles expired tokens transparently

## 🏃 Quick Start

### 1. Use This Template

Click the "Use this template" button above to create your own repository.

### 2. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
npm install
```

### 3. Configure

```bash
# Copy example config
cp wrangler.example.jsonc wrangler.jsonc

# Generate encryption key
openssl rand -base64 32

# Edit wrangler.jsonc with your values
```

### 4. Deploy

```bash
# Create KV namespaces
npx wrangler kv namespace create OAUTH_KV
npx wrangler kv namespace create SESSION_CACHE

# Deploy to Cloudflare
npx wrangler deploy
```

### 5. Connect Claude

Add to Claude Desktop config:
```json
{
  "mcpServers": {
    "your-server": {
      "command": "npx",
      "args": ["mcp-remote", "connect", "wss://your-server.workers.dev/mcp"]
    }
  }
}
```

## 📖 What's Included

### Example Tools

The template includes 6 example tools that demonstrate key patterns:

1. **Simple Authentication** - Basic tool with auth check
2. **API Calls** - Making external API requests
3. **Input Validation** - Complex parameter validation
4. **Batch Operations** - Processing multiple items
5. **Debug Tools** - Tools without auth requirements
6. **Content Types** - Different response formats

### File Structure

```
├── src/
│   ├── index.ts              # Your tools go here (with examples)
│   ├── xano-handler.ts       # OAuth flow (rarely need to edit)
│   ├── utils.ts              # API utilities
│   ├── refresh-profile.ts    # Token refresh logic
│   ├── smart-error.ts        # Error handling
│   └── workers-oauth-utils.ts # OAuth helpers
├── TEMPLATE_GUIDE.md         # Comprehensive documentation
├── wrangler.example.jsonc    # Example configuration
└── package.json
```

## 🛠️ Building Your Tools

### Basic Pattern

```typescript
this.server.tool(
  "your_tool_name",
  {
    // Define parameters with Zod
    param1: z.string().describe("Description"),
    param2: z.number().optional()
  },
  async ({ param1, param2 }) => {
    // Check authentication
    if (!this.props?.authenticated) {
      return SmartError.authenticationFailed().toMCPResponse();
    }

    try {
      // Your logic here
      const result = await doSomething(param1, param2);
      
      return {
        content: [{
          type: "text",
          text: `✅ Success!\n${JSON.stringify(result, null, 2)}`
        }]
      };
    } catch (error) {
      return new SmartError(
        "Operation failed",
        error.message
      ).toMCPResponse();
    }
  }
);
```

### Key Concepts

1. **Authentication**: Check `this.props?.authenticated`
2. **Parameters**: Use Zod schemas with `.describe()`
3. **Errors**: Use `SmartError` for consistency
4. **API Calls**: Use `this.makeAuthenticatedRequest()`
5. **Responses**: Return text content with clear formatting

## 📚 Documentation

See [TEMPLATE_GUIDE.md](TEMPLATE_GUIDE.md) for:
- Detailed explanations of each example
- Best practices and patterns
- Troubleshooting guide
- Customization options
- Architecture overview

## 🔧 Customization

### Change Authentication Backend

Edit the auth endpoint in `xano-handler.ts`:
```typescript
const authUrl = `${baseUrl}/your/auth/endpoint`;
```

### Add Environment Variables

1. Add to `wrangler.jsonc`:
```jsonc
"vars": {
  "YOUR_API_KEY": "value"
}
```

2. Update TypeScript interface in `index.ts`:
```typescript
export interface Env {
  YOUR_API_KEY: string;
}
```

### Remove Examples

Once you understand the patterns, replace the example tools in `index.ts` with your own.

## 🚀 Features

- **Secure**: User credentials are properly isolated
- **Persistent**: Sessions survive Worker hibernation
- **Scalable**: Built on Cloudflare's global network
- **Type-Safe**: Full TypeScript support
- **Well-Documented**: Every pattern explained

## 🤝 Contributing

This is a template repository. To contribute improvements:
1. Fork the repository
2. Make your changes
3. Submit a pull request

## 📄 License

MIT License - see LICENSE file

## 🔗 Resources

- [MCP Documentation](https://modelcontextprotocol.io/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Template Guide](TEMPLATE_GUIDE.md)

---

Built with security and education in mind. Ready for production use.