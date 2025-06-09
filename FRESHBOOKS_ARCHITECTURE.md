# FreshBooks MCP Architecture

## ✅ Key Insight: Xano Stays as Backend

Xano remains our authentication backend AND happens to be one of the tools we offer. For FreshBooks:
- No changes to xano-handler.ts (auth flow stays the same)
- No changes to OAuth login process
- Only change: `api_key` → `freshbooks_key` in user props

## 🔄 User Flow

1. **MCP Connection** (unchanged)
   - User connects to MCP server
   - Logs in with Xano credentials
   - Gets authenticated session

2. **FreshBooks Setup** (new, on mcp.snappy.ai)
   - User visits mcp.snappy.ai dashboard
   - Clicks "Connect FreshBooks"
   - Completes FreshBooks OAuth
   - Credentials stored in their Xano user record

3. **Using FreshBooks Tools**
   - MCP retrieves `freshbooks_key` from user's Xano data
   - Tools use this key for FreshBooks API calls
   - No direct OAuth in the MCP server

## 📝 Implementation Changes

### 1. Update Props Interface (index.ts)
```typescript
interface XanoAuthProps {
  accessToken: string;
  name: string;
  email: string;
  apiKey: string | null;        // Keep for Xano tools
  freshbooksKey: string | null;  // Add for FreshBooks
  userId: string;
  authenticated: boolean;
}
```

### 2. Update getFreshApiKey() Method
```typescript
async getFreshBooksKey(): Promise<string | null> {
  return this.props?.freshbooksKey || null;
}
```

### 3. Update User Fetch (utils.ts)
No change needed - Xano's auth/me will return freshbooks_key if user has connected it

### 4. Update OAuth Callback (xano-handler.ts line 244)
```typescript
props: {
  accessToken: token,
  name,
  email,
  apiKey: apiKey,
  freshbooksKey: userData.freshbooks_key || null, // Add this
  userId: userId,
  authenticated: true,
} as Props,
```

### 5. Replace Example Tools with FreshBooks Tools
```typescript
// Example: Create Invoice
this.server.tool(
  "freshbooks_create_invoice",
  {
    client_name: z.string().describe("Client name"),
    amount: z.number().describe("Invoice amount"),
    description: z.string().describe("Invoice description")
  },
  async ({ client_name, amount, description }) => {
    if (!this.props?.authenticated) {
      return SmartError.authenticationFailed().toMCPResponse();
    }

    const freshbooksKey = this.props.freshbooksKey;
    if (!freshbooksKey) {
      return new SmartError(
        "FreshBooks Not Connected",
        "Please connect your FreshBooks account at mcp.snappy.ai",
        { tip: "Visit mcp.snappy.ai and click 'Connect FreshBooks'" }
      ).toMCPResponse();
    }

    // Make FreshBooks API call
    const response = await fetch(
      `https://api.freshbooks.com/accounting/account/${ACCOUNT_ID}/invoices/invoices`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${freshbooksKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          invoice: {
            customerid: clientId,
            create_date: new Date().toISOString().split('T')[0],
            lines: [{
              type: 0,
              description,
              qty: 1,
              unit_cost: { amount: amount.toFixed(2), code: "USD" }
            }]
          }
        })
      }
    );

    // Handle response...
  }
);
```

## 🎯 Benefits of This Approach

1. **No OAuth Complexity** in MCP server
2. **Reuses 95%** of existing code
3. **Clean Separation** - Xano for auth, FreshBooks for invoicing
4. **Easy to Add More APIs** - Same pattern for QuickBooks, Stripe, etc.
5. **User Control** - Users manage connections on mcp.snappy.ai

## 🚀 Next Steps

1. Copy template to new directory
2. Update Props interface to include freshbooksKey
3. Replace example tools with FreshBooks tools
4. Update server name and description
5. Deploy to new Cloudflare Worker
6. Update mcp.snappy.ai to handle FreshBooks OAuth and store credentials in Xano