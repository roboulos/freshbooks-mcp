# Claude Context: Snappy MCP Critical Information

## ⚠️ CRITICAL SECURITY CONTEXT

### The API Key Vulnerability (FIXED)
There was a critical security vulnerability where all users were getting Robert Boulos' API key. This happened because:

1. **Root Cause**: When users didn't have an `api_key` in their Xano account, the code would:
   ```typescript
   const apiKey = userData.api_key || token;  // BAD: Falls back to OAuth token
   ```

2. **Token Refresh Bug**: When the OAuth token (incorrectly used as API key) got a 401 error, the refresh logic would:
   ```typescript
   // BAD: Takes the FIRST user's token, not the current user's
   const authEntries = await OAUTH_KV.list({ prefix: 'xano_auth_token:' });
   storageKey = authEntries.keys[0].name;  // This was Robert's token!
   ```

3. **The Fix** (implemented in commit 5417fa4):
   - Changed to: `const apiKey = userData.api_key || null;`
   - Made `refreshUserProfile` require a userId parameter
   - Token lookups now properly scoped: `storageKey = \`xano_auth_token:\${userId}\`;`

### Two Different auth/me Endpoints
**This is confusing but important:**
1. **Backend auth/me**: `https://xnwv-v1z6-dvnr.n7c.xano.io/api:e6emygx3/auth/me`
   - Used during OAuth login to get user info
   - Requires the OAuth token from login
   - Returns user's `api_key` for Meta API access

2. **Meta API auth/me**: `https://app.xano.com/api:meta/auth/me`
   - Used by tools to verify API key
   - Requires the user's Xano API key
   - Returns Xano account info

## 🏗️ Architecture Quick Reference

### File Structure (Minimal Clean Version)
```
src/
├── index.ts              # Main MCP server with 60+ Xano tools
├── xano-handler.ts       # OAuth flow handler
├── utils.ts              # API request utilities
├── refresh-profile.ts    # Token refresh logic (SECURITY CRITICAL)
├── smart-error.ts        # Error formatting
└── workers-oauth-utils.ts # OAuth utility functions
```

### Key Functions to Know
1. **`getFreshApiKey()`** in index.ts:
   - Returns API key from props
   - Props set during OAuth in xano-handler.ts

2. **`makeApiRequest()`** in utils.ts:
   - Makes API calls with automatic 401 retry
   - Now accepts userId for proper refresh

3. **`refreshUserProfile()`** in refresh-profile.ts:
   - **MUST** pass userId parameter
   - Fetches fresh API key when tokens expire

### OAuth Flow
1. User logs in via `/login` (xano-handler.ts)
2. Backend validates credentials
3. `/auth/me` returns user data including `api_key`
4. Props stored in Durable Object with user data
5. Tools use props.apiKey for Meta API calls

## 🚨 Common Issues & Solutions

### "Invalid token" Errors
1. **User has no API key**: They need to set one in their Xano account
2. **Wrong user's token**: Check the userId in logs matches the logged-in user
3. **Expired token**: Should auto-refresh if userId is passed correctly

### Testing Auth Issues
```bash
# Monitor logs during login
npx wrangler tail --format pretty

# Look for these log entries:
# "Props being set in completeAuthorization" - Shows what's stored
# "getFreshApiKey called with props" - Shows what's being used
# "Found stored auth token for user X" - MUST match current user!
```

### Deployment Commands
```bash
# Deploy to Cloudflare
npx wrangler deploy

# Check deployment status
npx wrangler deployments list

# View live logs
npx wrangler tail --format pretty
```

## 📝 For Future Development

### Adding New Tools
1. Add tool definition in `init()` method of MyMCP class
2. Use `this.makeAuthenticatedRequest()` for API calls (includes userId)
3. Follow existing error handling patterns with SmartError

### Updating OAuth Flow
- All OAuth logic is in `xano-handler.ts`
- Cookie encryption key must be secure (not the literal string!)
- Always store userId with credentials for proper isolation

### Security Checklist
- [ ] Never use OAuth tokens as API keys
- [ ] Always pass userId to refresh functions
- [ ] Validate userId matches the current session
- [ ] Use user-specific KV keys: `xano_auth_token:{userId}`

## 🔗 Important Links
- **Repository**: https://github.com/roboulos/cloudflare-mcp-server
- **Deployed URL**: https://xano-mcp-server.robertjboulos.workers.dev
- **Stable Branch**: stable-security-fix-2025-06-08
- **Clean Branch**: minimal-clean-version

## 🎯 Current State (as of 2025-06-08)
- **Version**: d75bee63-ba4a-4055-b478-397ff8fca474 (deployed)
- **Security**: Fixed - users properly isolated
- **Codebase**: Minimal - 6 core files + configs
- **Known Issues**: None critical
- **TTL**: 24 hours for session expiry

## 💡 Key Learnings
1. **Props isolation is critical** - Each Durable Object instance has its own props
2. **KV queries must be user-scoped** - Never list all users and take the first
3. **API keys ≠ OAuth tokens** - They serve different purposes
4. **Minimal is better** - Went from 100+ files to 12 files
5. **Test with multiple accounts** - Critical for multi-tenant systems