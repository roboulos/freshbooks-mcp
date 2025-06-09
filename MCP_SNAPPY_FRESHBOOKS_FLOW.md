# mcp.snappy.ai FreshBooks Integration Flow

## What Happens on mcp.snappy.ai

When a user clicks "Connect FreshBooks" on their dashboard:

### 1. FreshBooks OAuth Redirect
```javascript
// On mcp.snappy.ai frontend
function connectFreshBooks() {
  const clientId = 'YOUR_FRESHBOOKS_CLIENT_ID';
  const redirectUri = 'https://mcp.snappy.ai/integrations/freshbooks/callback';
  
  const authUrl = `https://auth.freshbooks.com/oauth/authorize?` +
    `client_id=${clientId}&` +
    `response_type=code&` +
    `redirect_uri=${redirectUri}`;
    
  window.location.href = authUrl;
}
```

### 2. Handle OAuth Callback
```javascript
// On mcp.snappy.ai backend (after user approves)
async function handleFreshBooksCallback(code) {
  // Exchange code for access token
  const tokenResponse = await fetch('https://api.freshbooks.com/auth/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: code,
      client_id: process.env.FRESHBOOKS_CLIENT_ID,
      client_secret: process.env.FRESHBOOKS_CLIENT_SECRET,
      redirect_uri: 'https://mcp.snappy.ai/integrations/freshbooks/callback'
    })
  });
  
  const { access_token, refresh_token } = await tokenResponse.json();
  
  // Store in user's Xano record
  await updateXanoUser(userId, {
    freshbooks_key: access_token,
    freshbooks_refresh_token: refresh_token,
    freshbooks_connected_at: new Date().toISOString()
  });
}
```

### 3. Update Xano User Record
```javascript
// API call to Xano to store FreshBooks credentials
async function updateXanoUser(userId, freshbooksData) {
  await fetch(`https://xnwv-v1z6-dvnr.n7c.xano.io/api:backend/users/${userId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${xanoAdminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      freshbooks_key: freshbooksData.freshbooks_key,
      freshbooks_refresh_token: freshbooksData.freshbooks_refresh_token,
      freshbooks_connected_at: freshbooksData.freshbooks_connected_at
    })
  });
}
```

## What the User Sees

1. **On mcp.snappy.ai Dashboard**
   ```
   ┌─────────────────────────────────┐
   │  Your Integrations              │
   │                                 │
   │  ✅ Xano (Connected)            │
   │                                 │
   │  ⚪ FreshBooks                  │
   │     [Connect FreshBooks]        │
   │                                 │
   │  ⚪ QuickBooks                  │
   │     [Coming Soon]               │
   └─────────────────────────────────┘
   ```

2. **After Connecting**
   ```
   ┌─────────────────────────────────┐
   │  Your Integrations              │
   │                                 │
   │  ✅ Xano (Connected)            │
   │                                 │
   │  ✅ FreshBooks (Connected)      │
   │     Last synced: Just now       │
   │     [Disconnect]                │
   │                                 │
   │  ⚪ QuickBooks                  │
   │     [Coming Soon]               │
   └─────────────────────────────────┘
   ```

## In Claude Desktop

The user just sees:
```
🔌 Available MCP Servers:
- xano (connected)
- freshbooks (connected)

📋 FreshBooks Tools:
- freshbooks_list_invoices
- freshbooks_send_saturday_invoices
- freshbooks_log_time
- freshbooks_create_invoice
- freshbooks_get_revenue_report
```

## Benefits

1. **Clean Separation** - OAuth complexity handled on web, not in MCP
2. **Multiple Integrations** - Same pattern for QuickBooks, Stripe, etc.
3. **User Control** - Easy to connect/disconnect services
4. **Secure** - Tokens stored in user's Xano account, not in MCP
5. **Scalable** - Add new services without changing MCP OAuth flow