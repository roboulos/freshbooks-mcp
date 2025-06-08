# Deployment Security Guide

## Required Environment Variables

To deploy this MCP server securely, you MUST set the following environment variables:

### 1. XANO_BASE_URL
- **Description**: Your Xano instance base URL
- **Example**: `https://your-instance.xano.io`
- **How to get**: From your Xano dashboard
- **Required**: YES

### 2. COOKIE_ENCRYPTION_KEY
- **Description**: A secure random string for encrypting OAuth session cookies
- **Example**: Generate with: `openssl rand -base64 32`
- **Required**: YES
- **Security**: NEVER commit this to version control

### 3. Cloudflare Configuration

1. Copy `wrangler.example.jsonc` to `wrangler.jsonc`
2. Replace the following placeholders:
   - `YOUR_CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
   - `YOUR_OAUTH_KV_NAMESPACE_ID`: Create a KV namespace for OAuth data
   - `YOUR_SESSION_CACHE_NAMESPACE_ID`: Create a KV namespace for session cache

## Setting Environment Variables in Cloudflare

### Via Dashboard:
1. Go to Workers & Pages > Your Worker > Settings > Variables
2. Add each environment variable
3. Encrypt sensitive values

### Via CLI:
```bash
wrangler secret put XANO_BASE_URL
wrangler secret put COOKIE_ENCRYPTION_KEY
```

## Security Checklist

- [ ] Never commit `wrangler.jsonc` with real account IDs
- [ ] Always use environment variables for sensitive data
- [ ] Generate a strong COOKIE_ENCRYPTION_KEY
- [ ] Set your own XANO_BASE_URL
- [ ] Review all endpoints to ensure no hardcoded URLs
- [ ] Enable Cloudflare Access if needed for additional security

## Testing Your Configuration

1. Deploy with: `wrangler deploy`
2. Check logs: `wrangler tail`
3. Verify environment variables are loaded correctly
4. Test OAuth flow with a test client

## Troubleshooting

If you see errors about missing environment variables:
1. Check that all variables are set in Cloudflare dashboard
2. Ensure variable names match exactly (case-sensitive)
3. Redeploy after setting variables