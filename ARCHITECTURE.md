# Snappy MCP Architecture

## Overview
Snappy MCP is a Model Context Protocol (MCP) server that provides Claude and other AI assistants with tools to interact with Xano backend services. It runs on Cloudflare Workers with OAuth authentication and Durable Objects for session management.

## Core Components

### 1. **index.ts** - Main MCP Server
- Extends `McpAgent` from the `agents` package
- Implements 60+ Xano tools for database operations, API management, etc.
- Contains the `MyMCP` Durable Object class for stateful sessions
- Handles tool execution and API communication with Xano

### 2. **xano-handler.ts** - OAuth Authentication
- Manages the OAuth flow for user authentication
- Renders login forms and handles callbacks
- Stores user credentials (auth tokens and API keys) in KV storage
- Key security fix: Properly isolates user data to prevent cross-user access

### 3. **utils.ts** - Utility Functions
- `makeApiRequest`: Handles API calls with automatic token refresh on 401 errors
- `fetchXanoUserInfo`: Fetches user data from Xano's auth/me endpoint
- Error handling and response formatting utilities

### 4. **refresh-profile.ts** - Token Refresh Logic
- Refreshes user profiles when tokens expire
- **Critical Security Fix**: Now requires userId parameter to prevent fetching wrong user's token
- Retrieves fresh API keys from Xano when needed

### 5. **smart-error.ts** - Error Handling
- Provides structured error responses with helpful hints
- Suggests related tools and next steps when operations fail

### 6. **workers-oauth-utils.ts** - OAuth Utilities
- Cookie handling for OAuth approval flow
- Renders approval dialogs
- Manages client authorization state

## Data Flow

### Authentication Flow
1. User initiates OAuth connection from Claude Desktop
2. `xano-handler.ts` presents login form
3. User enters Xano credentials
4. System calls Xano's `/auth/me` endpoint to get user info and API key
5. Credentials stored in KV storage with user-specific keys
6. OAuth Provider completes authorization with props containing user data

### Tool Execution Flow
1. User invokes a Xano tool in Claude
2. MCP server (Durable Object) receives request
3. `getFreshApiKey()` retrieves API key from props
4. Tool makes API request to Xano Meta API
5. If 401 error, `refresh-profile.ts` refreshes token (using correct userId)
6. Response formatted and returned to Claude

## Storage

### KV Storage Keys
- `xano_auth_token:{userId}` - User's auth token and profile data
- `token:*` - OAuth tokens (legacy format)
- `refresh:*` - Refresh tokens

### Durable Objects
- Each OAuth session gets its own Durable Object instance
- Props passed during OAuth contain user-specific data
- Ensures session isolation between users

## Security Considerations

### Critical Vulnerability Fixed
**Problem**: All users were getting Robert's API key due to:
1. Fallback to OAuth token when user had no API key
2. Token refresh logic grabbing first user's token instead of current user's

**Solution**:
1. No longer fall back to OAuth token as API key
2. `refreshUserProfile` now requires userId parameter
3. Proper user isolation in token lookups

### Current Security Model
- Each user's credentials stored with their userId
- 24-hour TTL on sessions
- Props isolation ensures users can't access each other's data
- API keys properly scoped to individual users

## Environment Variables
- `XANO_BASE_URL`: The Xano backend URL
- `COOKIE_ENCRYPTION_KEY`: Key for encrypting OAuth cookies
- `OAUTH_TOKEN_TTL`: Token lifetime in seconds (default: 86400 = 24 hours)

## Dependencies
- `@anthropic-ai/claude-mcp-server-sdk`: MCP server implementation
- `agents`: OAuth-enabled MCP agent base class
- `hono`: Web framework for request handling
- `itty-router`: Routing for Cloudflare Workers

## Deployment
Deployed to Cloudflare Workers using Wrangler:
- Durable Objects binding: `MCP_OBJECT`
- KV Namespaces: `OAUTH_KV`, `SESSION_CACHE`
- URL: https://xano-mcp-server.robertjboulos.workers.dev