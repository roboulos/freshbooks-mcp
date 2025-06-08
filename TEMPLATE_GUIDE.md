# MCP Server Template Guide

This template provides a production-ready foundation for building MCP (Model Context Protocol) servers with OAuth authentication on Cloudflare Workers.

## 🎯 What You Get

- **OAuth Authentication** - Secure login flow with session persistence
- **Example Tools** - 6 well-documented examples showing different patterns
- **Error Handling** - Consistent error responses with helpful hints
- **Token Management** - Automatic refresh on 401 errors
- **Clean Architecture** - Only 6 core files, easy to understand

## 🚀 Quick Start

### 1. Clone and Setup

```bash
# Clone this template
git clone https://github.com/your-username/mcp-server-template.git
cd mcp-server-template

# Install dependencies
npm install

# Copy example config
cp wrangler.example.jsonc wrangler.jsonc
```

### 2. Configure Cloudflare

Edit `wrangler.jsonc`:
```jsonc
{
  "name": "your-mcp-server",
  "account_id": "YOUR_CLOUDFLARE_ACCOUNT_ID",
  "kv_namespaces": [
    {
      "binding": "OAUTH_KV",
      "id": "YOUR_KV_ID"  // Create with: npx wrangler kv namespace create OAUTH_KV
    }
  ],
  "vars": {
    "XANO_BASE_URL": "https://your-backend.com",
    "COOKIE_ENCRYPTION_KEY": "..." // Generate with: openssl rand -base64 32
  }
}
```

### 3. Deploy

```bash
npx wrangler deploy
```

## 📚 Understanding the Examples

### Example 1: Simple Tool with Auth
```typescript
this.server.tool(
  "example_hello",
  {
    name: z.string().describe("Name to greet"),
    excited: z.boolean().optional()
  },
  async ({ name, excited }) => {
    // Always check authentication
    if (!this.props?.authenticated) {
      return { content: [{ type: "text", text: "🔒 Authentication required" }] };
    }
    // Your tool logic here
  }
);
```

**Key Patterns:**
- Use Zod schemas for parameter validation
- Always check `this.props?.authenticated`
- Return consistent response format

### Example 2: External API Calls
```typescript
const result = await this.makeAuthenticatedRequest(
  endpoint,
  method,
  data
);
```

**Key Patterns:**
- Use `makeAuthenticatedRequest` helper
- Handles token refresh automatically
- Consistent error handling with SmartError

### Example 3: Input Validation
```typescript
// Validate required fields
if (validate_required) {
  const missingFields = validate_required.filter(field => !fields[field]);
  if (missingFields.length > 0) {
    return new SmartError(
      "Missing required fields",
      `Required: ${missingFields.join(", ")}`,
      { tip: "Add the missing fields" }
    ).toMCPResponse();
  }
}
```

**Key Patterns:**
- Validate inputs before processing
- Return helpful error messages
- Include tips for fixing issues

### Example 4: Batch Operations
Shows how to:
- Process multiple items
- Track success/failure
- Return detailed results

### Example 5: Debug Tools
Shows how to:
- Create tools that don't require auth
- Useful for troubleshooting
- Return system status

### Example 6: Content Types
Shows how to:
- Return different formats
- Handle errors properly
- Format responses

## 🔧 Building Your Own Tools

### Basic Tool Structure

```typescript
this.server.tool(
  "your_tool_name",
  {
    // Parameters with Zod validation
    param1: z.string().describe("Description for Claude"),
    param2: z.number().optional().default(10)
  },
  async ({ param1, param2 }) => {
    // 1. Check authentication
    if (!this.props?.authenticated) {
      return SmartError.authenticationFailed().toMCPResponse();
    }

    try {
      // 2. Your tool logic
      const result = await yourBusinessLogic(param1, param2);

      // 3. Return success response
      return {
        content: [{
          type: "text",
          text: `✅ Success!\n${JSON.stringify(result, null, 2)}`
        }]
      };
    } catch (error) {
      // 4. Return error response
      return new SmartError(
        "Operation failed",
        error.message,
        { tip: "Check your inputs and try again" }
      ).toMCPResponse();
    }
  }
);
```

### Best Practices

1. **Always Check Auth**: Unless it's a debug tool
2. **Use SmartError**: Provides consistent error format
3. **Be Descriptive**: Use `.describe()` on Zod schemas
4. **Return JSON**: Use `JSON.stringify(data, null, 2)` for readability
5. **Add Emojis**: Makes output more scannable (✅ ❌ 🔍 📊)

## 🏗️ Architecture Overview

```
src/
├── index.ts              # Your MCP tools go here
├── xano-handler.ts       # OAuth login flow (rarely need to modify)
├── utils.ts              # API request utilities
├── refresh-profile.ts    # Token refresh logic
├── smart-error.ts        # Error handling
└── workers-oauth-utils.ts # OAuth helpers
```

### Key Components

**index.ts** - Where you add your tools
- Extends `McpAgent` class
- Tools defined in `init()` method
- Access auth data via `this.props`

**xano-handler.ts** - OAuth implementation
- Handles login form
- Manages token storage
- Usually don't need to modify

**utils.ts** - Request helpers
- `makeApiRequest` - Makes HTTP requests with auto-refresh
- `fetchXanoUserInfo` - Gets user profile

**smart-error.ts** - Error formatting
- Consistent error responses
- Helpful hints and tips
- Related tool suggestions

## 🔐 Authentication Flow

1. User connects to your MCP server
2. Redirected to login page (xano-handler.ts)
3. Enters credentials
4. System stores auth token and API key
5. Props populated with user data
6. Tools can access via `this.props`

### Available Props

```typescript
interface XanoAuthProps {
  accessToken: string;    // OAuth token
  name: string;          // User's name
  email: string;         // User's email
  apiKey: string | null; // API key for your backend
  userId: string;        // Unique user ID
  authenticated: boolean;
}
```

## 🚨 Common Issues

### "Authentication required"
- User needs to log in first
- Check that OAuth flow completed

### "Invalid token" 
- API key might be missing
- Token might be expired (will auto-refresh)

### "No API key available"
- User's account needs API key configured
- Check backend user settings

## 🎨 Customization

### Changing Auth Backend

Edit `xano-handler.ts`:
```typescript
// Change this URL to your auth endpoint
const authUrl = `${baseUrl}/your/auth/endpoint`;
```

### Adding Environment Variables

1. Add to `wrangler.jsonc`:
```jsonc
"vars": {
  "YOUR_NEW_VAR": "value"
}
```

2. Add to TypeScript interface:
```typescript
export interface Env {
  YOUR_NEW_VAR: string;
}
```

3. Access in tools:
```typescript
const value = this.env.YOUR_NEW_VAR;
```

### Customizing Error Messages

Create custom SmartError instances:
```typescript
return new SmartError(
  "Your error title",
  "Detailed explanation",
  {
    tip: "How to fix it",
    relatedTools: ["tool1", "tool2"],
    customData: "anything"
  }
).toMCPResponse();
```

## 📝 Tool Naming Conventions

- Use lowercase with underscores: `get_user_profile`
- Prefix by category: `db_create_record`, `api_fetch_data`
- Be descriptive: `analytics_calculate_monthly_revenue`

## 🚀 Deployment Tips

1. **Test Locally**: Use `npx wrangler dev`
2. **Check Logs**: `npx wrangler tail` for live logs
3. **Version Control**: Tag releases in git
4. **Environment Vars**: Use wrangler secrets for sensitive data

## 🔗 Connecting to Claude

Add to Claude Desktop config:
```json
{
  "mcpServers": {
    "your-server": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "connect",
        "wss://your-server.workers.dev/mcp"
      ]
    }
  }
}
```

## 📚 Resources

- [MCP Documentation](https://modelcontextprotocol.io)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Zod Documentation](https://zod.dev)

## 🎉 You're Ready!

1. Replace example tools with your own
2. Follow the patterns shown
3. Deploy to Cloudflare
4. Connect with Claude

Happy building! 🚀