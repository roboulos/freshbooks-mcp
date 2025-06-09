# FreshBooks MCP Adaptation Plan

## ✅ What We Have
- Clean OAuth template with 6 core files
- Cloudflare Workers deployment ready
- Secure authentication flow
- Example tools to replace

## 🔧 Key Changes Needed

### 1. Update OAuth Endpoints (xano-handler.ts)
```typescript
// FROM (Xano):
const authUrl = `${baseUrl}/auth/login`;

// TO (FreshBooks):
const authUrl = 'https://auth.freshbooks.com/oauth/authorize';
const tokenUrl = 'https://api.freshbooks.com/auth/oauth/token';
```

### 2. Update User Info Endpoint (utils.ts)
```typescript
// FROM (Xano):
export async function fetchXanoUserInfo(token: string, baseUrl: string)

// TO (FreshBooks):
export async function fetchFreshBooksUserInfo(token: string)
// GET https://api.freshbooks.com/auth/api/v1/users/me
```

### 3. Update Environment Variables (wrangler.jsonc)
```jsonc
{
  "vars": {
    "FRESHBOOKS_CLIENT_ID": "your-client-id",
    "FRESHBOOKS_CLIENT_SECRET": "your-secret",
    "FRESHBOOKS_REDIRECT_URI": "https://your-worker.workers.dev/callback",
    "FRESHBOOKS_ACCOUNT_ID": "your-account-id"
  }
}
```

### 4. Replace Example Tools (index.ts)
Replace the 6 example tools with FreshBooks-specific ones:
- `create_invoice`
- `list_invoices`
- `log_time_entry`
- `get_revenue_report`
- `list_clients`

## 🚀 Implementation Steps

### Step 1: Set up FreshBooks App
1. Log into FreshBooks account
2. Go to Settings → Developer → My Apps
3. Create new app with redirect URI: `https://your-worker.workers.dev/callback`
4. Note Client ID and Secret

### Step 2: Update OAuth Flow
The main change is FreshBooks uses standard OAuth2 (not custom like Xano):
- Authorization URL includes client_id, redirect_uri, response_type=code
- Exchange code for token at token endpoint
- Use Bearer token for API calls

### Step 3: Create Invoice Tool
```typescript
this.server.tool(
  "create_invoice",
  {
    client_name: z.string().describe("Client name or ID"),
    line_items: z.array(z.object({
      description: z.string(),
      qty: z.number(),
      unit_cost: z.number()
    })).describe("Invoice line items"),
    due_offset_days: z.number().optional().default(30)
  },
  async ({ client_name, line_items, due_offset_days }) => {
    if (!this.props?.authenticated) {
      return SmartError.authenticationFailed().toMCPResponse();
    }

    // 1. Find client
    const clientsUrl = `https://api.freshbooks.com/accounting/account/${this.env.FRESHBOOKS_ACCOUNT_ID}/users/clients`;
    const clients = await this.makeAuthenticatedRequest(clientsUrl);
    
    // 2. Create invoice
    const invoiceData = {
      invoice: {
        customerid: clientId,
        create_date: new Date().toISOString().split('T')[0],
        due_offset_days,
        lines: line_items.map(item => ({
          type: 0,
          description: item.description,
          qty: item.qty,
          unit_cost: {
            amount: item.unit_cost.toFixed(2),
            code: "USD"
          }
        }))
      }
    };
    
    const result = await this.makeAuthenticatedRequest(
      `https://api.freshbooks.com/accounting/account/${this.env.FRESHBOOKS_ACCOUNT_ID}/invoices/invoices`,
      "POST",
      invoiceData
    );
    
    return {
      content: [{
        type: "text",
        text: `✅ Invoice created!\n\nInvoice #${result.invoice.invoice_number}\nAmount: $${result.invoice.amount.amount}\nDue: ${result.invoice.due_date}`
      }]
    };
  }
);
```

## 📝 Minimal Changes Approach

Since you want to confirm before making changes:

1. **Copy the template to a new directory**: 
   ```bash
   cp -r mcp-oauth-template freshbooks-mcp
   ```

2. **Main files to modify**:
   - `src/index.ts` - Replace tools, update server name
   - `src/xano-handler.ts` - Update OAuth URLs
   - `src/utils.ts` - Update API endpoints
   - `wrangler.jsonc` - Update environment variables

3. **Keep unchanged**:
   - `smart-error.ts` - Error handling works as-is
   - `refresh-profile.ts` - Token refresh logic is the same
   - `workers-oauth-utils.ts` - OAuth helpers are generic

## 🎯 Quick Win Path
1. Deploy with just `create_invoice` tool first
2. Test with Saturday invoicing
3. Add more tools based on what you need
4. Launch to beta users

This approach reuses 80% of your existing code!