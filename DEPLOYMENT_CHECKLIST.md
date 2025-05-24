# Deployment Checklist for MCP Authentication

## Backend Requirements (Xano)

### 1. Create `mcp_sessions` table
Fields needed:
- `id` (integer, auto-increment)
- `session_id` (text, unique, required)
- `user_id` (text, required)
- `client_info` (JSON object)
- `status` (text, default: 'active')
- `last_active` (timestamp)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### 2. Create `usage_logs` table
Fields needed:
- `id` (integer, auto-increment)
- `session_id` (text, required)
- `user_id` (text, required)
- `tool_name` (text, required)
- `params` (JSON object)
- `result` (JSON object)
- `error` (text, nullable)
- `duration` (integer) - milliseconds
- `timestamp` (timestamp)
- `ip_address` (text)
- `ai_model` (text)
- `cost` (decimal)
- `created_at` (timestamp)

### 3. Create API endpoints

#### POST /mcp_sessions
- Creates new session
- Input: `{ session_id, user_id, client_info, status }`
- Returns: created session object

#### GET /mcp_sessions/{session_id}
- Retrieves session by ID
- Returns: session object or 404

#### PUT /mcp_sessions/{session_id}
- Updates session (mainly last_active)
- Input: `{ last_active, status }`
- Returns: updated session

#### POST /usage_logs
- Creates usage log entry
- Input: all usage_logs fields
- Returns: created log entry

## Cloudflare Setup

### 1. Create Queue
In Cloudflare Dashboard:
1. Go to Workers & Pages > Queues
2. Create new queue named `usage-queue`
3. Note the queue name for wrangler.toml

### 2. Update wrangler.toml
```toml
[[queues.producers]]
  queue = "usage-queue"
  binding = "USAGE_QUEUE"

[[queues.consumers]]
  queue = "usage-queue"
  max_batch_size = 100
  max_batch_timeout = 30
```

### 3. Environment Variables
Add to `.dev.vars` for local testing:
```
SERVICE_CREDENTIALS='{"xano":{"service_name":"xano","auth_type":"api_key","credentials_encrypted":"encrypted:{\"api_key\":\"YOUR_KEY\",\"base_url\":\"https://xnwv-v1z6-dvnr.n7c.xano.io\"}"}}'
```

Add to Cloudflare Dashboard > Workers > Settings > Variables for production.

## Testing Steps

1. **Test auth/me endpoint**:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://xnwv-v1z6-dvnr.n7c.xano.io/api:e6emygx3/auth/me
   ```

2. **Deploy to development**:
   ```bash
   npm run deploy
   ```

3. **Test MCP authentication**:
   ```bash
   curl -X POST https://your-worker.workers.dev/mcp \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
   ```

## Monitoring

- Check Cloudflare Analytics for request counts
- Monitor Queue metrics for usage logging
- Check Xano tables for session and usage data

## Rollback Plan

If issues occur:
1. Revert to previous deployment in Cloudflare
2. Disable authentication temporarily by commenting out middleware
3. Check logs in Cloudflare dashboard