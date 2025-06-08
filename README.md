# Snappy MCP Server

A Model Context Protocol (MCP) server that enables Claude and other AI assistants to interact with Xano backend services through 60+ specialized tools.

## 🚨 Recent Security Fix (2025-06-08)

Fixed a critical security vulnerability where users were getting each other's API keys. All users are now properly isolated with their own credentials.

## Overview

Snappy MCP runs on Cloudflare Workers and provides:
- 🔐 **OAuth Authentication** - Secure login with Xano credentials
- 🛠️ **60+ Xano Tools** - Complete database, API, and file management
- 🔄 **Automatic Token Refresh** - Handles expired tokens transparently
- 💾 **Session Persistence** - Maintains auth across Worker restarts
- 🏗️ **Minimal Architecture** - Only 6 core files for easy maintenance

## Quick Start

### Prerequisites
- Cloudflare account with Workers enabled
- Xano instance with authentication endpoint
- Node.js and npm installed
- Wrangler CLI: `npm install -g wrangler`

### Installation

```bash
# Clone the repository
git clone https://github.com/roboulos/cloudflare-mcp-server.git
cd cloudflare-mcp-server

# Install dependencies
npm install

# Configure your environment
cp wrangler.example.jsonc wrangler.jsonc
# Edit wrangler.jsonc with your values

# Deploy to Cloudflare
npx wrangler deploy
```

### Configuration

Update `wrangler.jsonc` with your settings:
```jsonc
{
  "vars": {
    "XANO_BASE_URL": "https://your-instance.xano.io",
    "COOKIE_ENCRYPTION_KEY": "generate-a-secure-key-here"
  }
}
```

Generate a secure cookie encryption key:
```bash
openssl rand -base64 32
```

### Connecting Claude Desktop

Add to your Claude Desktop config:
```json
{
  "mcpServers": {
    "snappy-mcp": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "connect",
        "wss://your-worker.workers.dev/mcp"
      ]
    }
  }
}
```

## Authentication

1. Start Claude Desktop and select the Snappy MCP server
2. You'll be redirected to a login page
3. Enter your Xano credentials
4. The system will store your API key securely

**Important**: You must have an API key configured in your Xano account settings.

## Available Tools

### Instance & Workspace Management
- `xano_list_instances` - List all Xano instances
- `xano_get_instance_details` - Get instance information
- `xano_list_databases` - List workspaces/databases
- `xano_get_workspace_details` - Get workspace details

### Table Operations
- `xano_list_tables` - List all tables in a workspace
- `xano_get_table_details` - Get table information
- `xano_create_table` - Create a new table
- `xano_update_table` - Update table metadata
- `xano_delete_table` - Delete a table

### Schema Management
- `xano_get_table_schema` - Get table schema
- `xano_add_field_to_schema` - Add a field to table
- `xano_rename_schema_field` - Rename a field
- `xano_delete_field` - Delete a field

### Record Operations
- `xano_browse_table_content` - Browse table records
- `xano_get_table_record` - Get specific record
- `xano_create_table_record` - Create new record
- `xano_update_table_record` - Update existing record
- `xano_delete_table_record` - Delete a record
- `xano_bulk_create_records` - Create multiple records
- `xano_bulk_update_records` - Update multiple records

### API Management
- `xano_list_api_groups` - List API groups
- `xano_create_api_group` - Create new API group
- `xano_list_apis_in_group` - List APIs in a group
- `xano_create_api` - Create new API endpoint
- `xano_get_api_details` - Get API configuration
- `xano_update_api` - Update API settings

### File Management
- `xano_list_files` - List uploaded files
- `xano_upload_file` - Upload a file
- `xano_delete_file` - Delete a file

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed technical information.

### Core Files
- `src/index.ts` - Main MCP server implementation
- `src/xano-handler.ts` - OAuth authentication handler
- `src/utils.ts` - API utilities and token refresh
- `src/refresh-profile.ts` - User profile refresh logic
- `src/smart-error.ts` - Error handling
- `src/workers-oauth-utils.ts` - OAuth utility functions

## Troubleshooting

### Common Issues

**"Invalid token" errors**
- Ensure you have an API key set in your Xano account
- Try logging out and back in
- Check that you're using the correct Xano instance

**Authentication failures**
- Clear cookies and try again
- Verify your Xano credentials
- Check Cloudflare Worker logs: `npx wrangler tail`

**Connection issues**
- Ensure your Worker is deployed: `npx wrangler deploy`
- Check Claude Desktop logs: `~/Library/Logs/Claude/`
- Verify MCP configuration in Claude Desktop

### Debug Tools

The server includes debug tools (when authenticated):
- `debug_auth` - Check authentication status
- `debug_expire_oauth_tokens` - Test token expiry
- `debug_refresh_profile` - Force token refresh

## Security

- User credentials are isolated per-user
- API keys are stored encrypted in KV storage
- OAuth tokens have 24-hour TTL
- No cross-user data access

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Links

- **Repository**: https://github.com/roboulos/cloudflare-mcp-server
- **Issues**: https://github.com/roboulos/cloudflare-mcp-server/issues
- **MCP Documentation**: https://modelcontextprotocol.io/
- **Xano Documentation**: https://docs.xano.com/