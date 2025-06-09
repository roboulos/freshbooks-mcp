# FreshBooks MCP - Quick Implementation Guide

## Step 1: Copy Template
```bash
cd /Users/sboulos/Desktop/ACTIVE_PROJECTS/
cp -r mcp-oauth-template freshbooks-mcp
cd freshbooks-mcp
```

## Step 2: Update src/index.ts

### 2a. Update Props Interface (line 8)
```typescript
interface XanoAuthProps {
  accessToken: string;
  name: string;
  email: string;
  apiKey: string | null;
  freshbooksKey: string | null;  // ADD THIS
  userId: string;
  authenticated: boolean;
}
```

### 2b. Add FreshBooks Key Getter (after line 62)
```typescript
async getFreshBooksKey(): Promise<string | null> {
  return this.props?.freshbooksKey || null;
}
```

### 2c. Update Server Info (line 48)
```typescript
server = new McpServer({
  name: "FreshBooks MCP Server",
  version: "1.0.0",
});
```

### 2d. Replace ALL Example Tools with FreshBooks Tools
Delete lines 77-382 and add:

```typescript
// Tool 1: List Invoices
this.server.tool(
  "freshbooks_list_invoices",
  {
    status: z.enum(["draft", "sent", "viewed", "paid", "auto-paid", "retry", "failed", "partial"]).optional(),
    page: z.number().optional().default(1)
  },
  async ({ status, page }) => {
    if (!this.props?.authenticated) {
      return SmartError.authenticationFailed().toMCPResponse();
    }

    const freshbooksKey = this.props.freshbooksKey;
    if (!freshbooksKey) {
      return new SmartError(
        "FreshBooks Not Connected",
        "Connect your FreshBooks account at mcp.snappy.ai",
        { tip: "Visit mcp.snappy.ai → Integrations → Connect FreshBooks" }
      ).toMCPResponse();
    }

    try {
      const url = new URL(`https://api.freshbooks.com/accounting/account/${this.env.FRESHBOOKS_ACCOUNT_ID}/invoices/invoices`);
      url.searchParams.set("page", page.toString());
      url.searchParams.set("per_page", "50");
      if (status) url.searchParams.set("search[status]", status);

      const response = await fetch(url.toString(), {
        headers: {
          "Authorization": `Bearer ${freshbooksKey}`,
          "Api-Version": "alpha",
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`FreshBooks API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        content: [{
          type: "text",
          text: `📄 Found ${data.invoices.length} invoices\n\n${data.invoices.map(inv => 
            `• Invoice #${inv.invoice_number} - ${inv.organization} - $${inv.amount.amount} (${inv.status})`
          ).join('\n')}`
        }]
      };
    } catch (error) {
      return new SmartError(
        "Failed to fetch invoices",
        error.message
      ).toMCPResponse();
    }
  }
);

// Tool 2: Send Saturday Invoices
this.server.tool(
  "freshbooks_send_saturday_invoices",
  {
    dry_run: z.boolean().default(true).describe("Preview without sending")
  },
  async ({ dry_run }) => {
    if (!this.props?.authenticated) {
      return SmartError.authenticationFailed().toMCPResponse();
    }

    const freshbooksKey = this.props.freshbooksKey;
    if (!freshbooksKey) {
      return new SmartError(
        "FreshBooks Not Connected",
        "Connect your FreshBooks account at mcp.snappy.ai"
      ).toMCPResponse();
    }

    try {
      // Get draft invoices
      const response = await fetch(
        `https://api.freshbooks.com/accounting/account/${this.env.FRESHBOOKS_ACCOUNT_ID}/invoices/invoices?search[status]=draft`,
        {
          headers: {
            "Authorization": `Bearer ${freshbooksKey}`,
            "Api-Version": "alpha"
          }
        }
      );

      const data = await response.json();
      const draftInvoices = data.invoices || [];

      if (draftInvoices.length === 0) {
        return {
          content: [{
            type: "text",
            text: "✅ No draft invoices to send"
          }]
        };
      }

      if (dry_run) {
        return {
          content: [{
            type: "text",
            text: `📋 ${draftInvoices.length} invoices ready to send:\n\n${draftInvoices.map(inv => 
              `• ${inv.organization} - $${inv.amount.amount}`
            ).join('\n')}\n\nRun with dry_run=false to send`
          }]
        };
      }

      // Send each invoice
      const results = [];
      for (const invoice of draftInvoices) {
        const sendResponse = await fetch(
          `https://api.freshbooks.com/accounting/account/${this.env.FRESHBOOKS_ACCOUNT_ID}/invoices/invoices/${invoice.id}/send`,
          {
            method: "PUT",
            headers: {
              "Authorization": `Bearer ${freshbooksKey}`,
              "Api-Version": "alpha",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              invoice: {
                email_recipients: [invoice.contacts[0]?.email].filter(Boolean),
                invoice_customized_email: {
                  subject: "Invoice from Robert Boulos",
                  body: "Please find your invoice attached. Thank you for your business!"
                }
              }
            })
          }
        );

        results.push({
          client: invoice.organization,
          success: sendResponse.ok,
          amount: invoice.amount.amount
        });
      }

      return {
        content: [{
          type: "text",
          text: `✉️ Saturday Invoices Sent!\n\n${results.map(r => 
            `${r.success ? '✅' : '❌'} ${r.client} - $${r.amount}`
          ).join('\n')}`
        }]
      };
    } catch (error) {
      return new SmartError(
        "Failed to send invoices",
        error.message
      ).toMCPResponse();
    }
  }
);

// Tool 3: Log Time Entry
this.server.tool(
  "freshbooks_log_time",
  {
    client_name: z.string().describe("Client name"),
    hours: z.number().describe("Hours worked"),
    description: z.string().describe("Work description"),
    date: z.string().optional().describe("Date (YYYY-MM-DD)")
  },
  async ({ client_name, hours, description, date }) => {
    // Implementation similar to above...
  }
);
```

## Step 3: Update src/xano-handler.ts (line 244)
```typescript
props: {
  accessToken: token,
  name,
  email,
  apiKey: apiKey,
  freshbooksKey: userData.freshbooks_key || null, // ADD THIS
  userId: userId,
  authenticated: true,
} as Props,
```

## Step 4: Update wrangler.jsonc
```jsonc
{
  "name": "freshbooks-mcp-server",
  // ... other config ...
  "vars": {
    "XANO_BASE_URL": "https://xnwv-v1z6-dvnr.n7c.xano.io",
    "FRESHBOOKS_ACCOUNT_ID": "YOUR_ACCOUNT_ID" // Add this
  }
}
```

## Step 5: Deploy
```bash
npx wrangler deploy
```

## Step 6: Update Claude Config
```json
{
  "mcpServers": {
    "freshbooks": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "connect",
        "wss://freshbooks-mcp-server.robertjboulos.workers.dev/mcp"
      ]
    }
  }
}
```

## That's It! 🎉
- Xano handles authentication (unchanged)
- FreshBooks key comes from user's Xano account
- Tools use FreshBooks API with the stored key
- OAuth for FreshBooks happens on mcp.snappy.ai (separate)