# Xano MCP Server with Persistent Authentication

A Cloudflare Workers-based MCP (Model Context Protocol) server that authenticates with Xano and maintains persistent authentication state across Durable Object hibernation using OAuthProvider. This server enables AI assistants like Claude to securely interact with your Xano backend even after periods of inactivity.

✅ **WORKING IMPLEMENTATION**: This branch contains a fully functional OAuth implementation that successfully connects to the CloudFlare AI Playground with Xano authentication and provides extensive Xano API tools for AI agents.

## Branch Information

This repository is organized into several branches for different use cases:

1. **`main`**: Minimal implementation with basic token validation
2. **`xano-tools`**: Adds Xano API tools while maintaining simple token validation
3. **`oauth-provider`**: Uses OAuthProvider for persistent authentication with email/password login
4. **`xano-tools-expansion`** (current): Extends the oauth-provider branch with an expanded set of Xano tools

```bash
# For minimal implementation (stable)
git checkout main

# For implementation with basic Xano tools
git checkout xano-tools

# For implementation with persistent OAuth (advanced)
git checkout oauth-provider

# For implementation with expanded Xano tools and persistent OAuth (recommended)
git checkout xano-tools-expansion
```

## Implementation Details

This is the **expanded Xano tools with persistent authentication** implementation, which builds on the oauth-provider branch and adds:

### What This Implementation Does
- **Web-based Authentication Form**: Login with Xano email/password or API token
- **OAuth Flow**: Implements a standard OAuth 2.0 flow for persistent authentication
- **Persistent Tokens**: Maintains authentication state across Durable Object hibernation
- **Token Refreshing**: Automatically handles token expiration and refreshing
- **Connection Resilience**: Reconnects with preserved authentication state
- **API Key Extraction**: Properly extracts and uses the Xano API key from auth/me response
- **Expanded Xano Tools**: Adds 20+ tools for comprehensive Xano API management

### Advantages Over Other Branches
- **Comprehensive Tool Set**: Expanded tool coverage for table management, schemas, and data operations
- **Login UI**: Interactive login with direct email/password or token options
- **Session Management**: Tokens persist even after Worker restarts or Durable Object hibernation
- **User-Friendly**: Better authentication experience for non-technical users
- **Enhanced Security**: Proper token management and storage practices
- **Code Organization**: Uses Hono framework for routing and request handling
- **Compatibility**: Works with both AI Playground and Claude Desktop applications

## Features

- **Interactive Login Form**: Email/password or API token authentication options
- **OAuth 2.0 Implementation**: Standard authorization_code flow with refresh tokens
- **KV Token Storage**: Secure token storage with proper expiration handling
- **Connection Resilience**: Handles disconnections and hibernation gracefully
- **TypeScript Support**: Full type safety throughout the codebase
- **Debug Endpoints**: Utilities for troubleshooting authentication issues
- **Extensive Xano API Tools**: 20+ tools covering all major Xano operations

## Recent Improvements (v1.3.0 - May 2024)

1. **Standardized Response Format**
   - Implemented a consistent structure with `success`, `data`, `message`, and `operation` fields
   - Made error responses follow the same pattern with standardized error objects
   - Eliminated inconsistency across different tool responses

2. **Proper API Response Handling**
   - Fixed critical issues with interpreting non-standard API responses (like empty arrays or null values)
   - Added robust handling for bulk operations with their unique response formats
   - Improved status code interpretation for various operations (particularly DELETEs)

3. **Enhanced Schema Operations**
   - Fixed schema field operations to properly maintain field order
   - Improved field deletion and renaming operations to handle API responses correctly
   - Better validation for schema-related parameters

4. **Bulk Operations Support**
   - Complete rewrite of bulk creation and update functionality
   - Added proper format conversion between client and API expectations
   - Implemented response transformation to provide useful update statistics

5. **Error Handling and Reporting**
   - More descriptive error messages with relevant context
   - Proper error classification with appropriate error codes
   - Distinction between API errors, validation errors, and exceptions

## Prerequisites

- A Cloudflare account with Workers access and KV storage
- A Xano instance with authentication API endpoint
- npm and wrangler CLI installed
- **IMPORTANT**: The latest version of mcp-remote (`npm install -g mcp-remote@latest`) is required for Claude Desktop to properly open the authentication browser window

## Project Status and Implementation Progress

### Current Status: Working Implementation

The OAuth implementation for the Xano MCP server is now successfully working with the CloudFlare AI Playground and other MCP clients. The implementation:

1. Successfully handles the full OAuth authorization flow with Xano login
2. Presents a clean login UI with email/password or token authentication options
3. Maintains consistent client ID throughout the OAuth flow
4. Resolves the "Client ID mismatch" error during token exchange
5. Properly preserves state across the OAuth flow's multiple redirects
6. Implements client approval with cookie-based storage for returning users
7. Provides 20+ Xano API tools for comprehensive database and table management

For detailed information on how the OAuth implementation works, check out the [OAuth Implementation Documentation](./OAUTH_IMPLEMENTATION.md).

### Xano Tools Implementation

This branch provides a comprehensive set of Xano API tools with standardized response formats:

#### Table Management Tools
- **xano_list_instances**: Lists all Xano instances associated with the account
- **xano_get_instance_details**: Gets details for a specific Xano instance
- **xano_list_databases**: Lists all databases (workspaces) in a specific Xano instance
- **xano_get_workspace_details**: Gets details for a specific Xano workspace
- **xano_list_tables**: Lists all tables in a specific Xano workspace
- **xano_get_table_details**: Gets details for a specific Xano table
- **xano_create_table**: Creates a new table in a workspace
- **xano_update_table**: Updates an existing table in a workspace
- **xano_delete_table**: Deletes a table from a workspace

#### Schema Management Tools
- **xano_get_table_schema**: Gets schema for a specific Xano table
- **xano_add_field_to_schema**: Adds a new field to a table schema
- **xano_rename_schema_field**: Renames a field in a table schema
- **xano_delete_field**: Deletes a field from a table schema

#### Record Management Tools
- **xano_browse_table_content**: Browses content for a specific Xano table
- **xano_get_table_record**: Gets a specific record from a table
- **xano_create_table_record**: Creates a new record in a table
- **xano_update_table_record**: Updates an existing record in a table
- **xano_delete_table_record**: Deletes a record from a table
- **xano_bulk_create_records**: Creates multiple records in a single operation
- **xano_bulk_update_records**: Updates multiple records in a single operation

All tools follow consistent patterns for authentication, error handling, and parameter validation using Zod.

### Setup Instructions

1. Clone this repository:
   ```bash
   git clone https://github.com/roboulos/cloudflare-mcp-server.git
   cd cloudflare-mcp-server
   git checkout xano-tools-expansion
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a KV namespace for token storage:
   ```bash
   npx wrangler kv namespace create OAUTH_KV
   ```

4. Update your wrangler.toml with the KV namespace ID from the previous step:
   ```toml
   [[kv_namespaces]]
   binding = "OAUTH_KV"
   id = "YOUR_KV_NAMESPACE_ID"  # Replace with your actual KV namespace ID
   ```

5. Update your Xano URL in wrangler.toml with your instance's URL, and set a COOKIE_ENCRYPTION_KEY for the client approval feature:
   ```toml
   [vars]
   XANO_BASE_URL = "https://YOUR-INSTANCE.n7c.xano.io"
   COOKIE_ENCRYPTION_KEY = "your-secret-key-for-cookie-encryption"
   ```

6. Deploy to Cloudflare:
   ```bash
   npx wrangler deploy
   ```

7. Connect using any MCP client (like Claude or Cursor):
   ```
   https://your-worker.your-account.workers.dev/sse
   ```
   You'll see a login form where you can authenticate with Xano credentials

## Authentication Flow

### OAuth Flow

1. A client requests the `/sse` endpoint
2. The OAuthProvider redirects to the `/authorize` endpoint
3. The user is presented with a login form to authenticate with Xano
4. Upon successful authentication, an authorization code is generated
5. The client exchanges the code for access and refresh tokens
6. Tokens are stored in KV for future use
7. The client can reconnect using the tokens, without requiring re-authentication

### Authentication Options

1. **Email/Password Login**: Authenticate using your Xano account credentials
2. **Direct Token Use**: Provide a Xano API token directly
3. **Refresh Token**: Automatically refresh expired tokens

## Key Files

- `src/index.ts`: Main entry point with OAuthProvider, MCP agent setup, and expanded Xano tools
- `src/xano-handler.ts`: Handler for OAuth flow and authentication logic
- `src/utils.ts`: Utility functions for API requests and token management
- `wrangler.toml`: Worker configuration with KV and environment settings

## Technical Architecture

The implementation uses Cloudflare's OAuthProvider pattern for authentication persistence:

1. **OAuthProvider** (index.ts)
   - Central hub for OAuth flow and token management
   - Configures routes for authorization, token exchange, and API access
   - Manages token persistence through KV storage

2. **XanoHandler** (xano-handler.ts)
   - Implements the OAuth flow endpoints
   - Handles initial authentication with Xano
   - Manages token lifecycle (creation, storage, refresh)
   - Provides login UI for user authentication

3. **MCP Agent** (index.ts)
   - Implements Xano API tools with authentication checks
   - Uses stored authentication data for API operations
   - Enforces authentication requirements for protected operations
   - Includes extensive set of Xano API tools for database management

4. **Utilities** (utils.ts)
   - Handles token extraction and validation
   - Provides helper functions for API requests
   - Manages token storage and retrieval from KV

## Authentication Endpoints

- `/authorize`: Presents the login UI and handles initial authentication
- `/token`: Handles the OAuth token exchange
- `/refresh`: Refreshes expired access tokens
- `/oauth-callback`: Handles the OAuth redirect callback
- `/status`: Endpoint to check authentication status
- `/debug-oauth`: Debugging endpoint for OAuth flow issues

## Standardized Response Format

All tool responses now follow a consistent pattern:

- Success case:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "operation": "xano_operation_name"
}
```

- Error case:
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": { ... }
  },
  "operation": "xano_operation_name"
}
```

## Troubleshooting

- **Authentication Failures**: Try clearing browser cookies and localStorage
- **KV Issues**: Verify KV namespace is correctly configured in wrangler.toml
- **Login Problems**: Check that your Xano instance URL is correct
- **Web UI Issues**: Try with a different browser or incognito mode
- **Debugging**: Access `/debug-oauth` endpoint for diagnostic information
- **Client ID Errors**: Check the "Client lookup for ID" logs in the worker logs
- **Tool Conflicts**: Ensure no duplicate MCP servers with similar tool names in Claude Desktop config
- **API Key Issues**: Use the `debug_auth` tool to verify API key extraction
- **Claude Desktop Connection**: Check logs in `~/Library/Logs/Claude/mcp-server-*.log`
- **Xano API Errors**: Check for valid API key and proper Xano instance name format

### Debugging Endpoints

- `/health`: Check if the server is running correctly
- `/status`: View current authentication status (requires bearer token)
- `/debug-oauth`: Debug endpoint with request and authentication information

## Resources

- [Model Context Protocol (MCP) Documentation](https://github.com/anthropics/model-context-protocol)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare OAuth Provider](https://developers.cloudflare.com/workers/runtime-apis/oauth/)
- [Xano Documentation](https://docs.xano.com/)
- [Hono Documentation](https://hono.dev/)

## License

MIT