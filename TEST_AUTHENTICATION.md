# Authentication Testing Guide

## Current Issue
Users are seeing Robert's account data when using the Snappy MCP tools. This could be due to:
1. Cached sessions from old deployments
2. Shared props in the OAuth provider
3. KV storage returning wrong user data

## How to Test

### Test 1: Fresh User (Incognito)
1. Open an incognito/private browser window
2. Go to: https://xano-mcp-server.robertjboulos.workers.dev/authorize
3. Login with test credentials
4. Check what account info is shown

### Test 2: Clear Existing Session
1. Clear all cookies for `robertjboulos.workers.dev`
2. In Claude Desktop, disconnect and reconnect the Snappy MCP
3. Go through OAuth flow again
4. Test the `xano_auth_me` tool

### Test 3: Check KV Storage
Run these commands to see what's stored:
```bash
cd /Users/sboulos/Desktop/ACTIVE_PROJECTS/Snappy_MCP_Cloudflare
npx wrangler kv key list --namespace-id c43c2dc2174244c8bb1d4e5bb9cf6fa4 --prefix xano_auth_token
npx wrangler kv key list --namespace-id c43c2dc2174244c8bb1d4e5bb9cf6fa4 --prefix token:
```

### What to Look For
- Does a fresh user still see Robert's account?
- Are there multiple auth tokens in KV?
- Does clearing cookies fix the issue?

## Debug Endpoints
- Check auth status: https://xano-mcp-server.robertjboulos.workers.dev/status
- Debug OAuth: https://xano-mcp-server.robertjboulos.workers.dev/debug-oauth