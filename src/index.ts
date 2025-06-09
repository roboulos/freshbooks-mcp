import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, fetchXanoUserInfo } from "./utils";
import { SmartError } from "./smart-error";

// Props passed from OAuth - contains user authentication data
interface XanoAuthProps {
  accessToken: string;
  name: string;
  email: string;
  apiKey: string | null;
  freshbooksKey: string | null;  // FreshBooks API key from user's Xano account
  userId: string;
  authenticated: boolean;
}

// Environment bindings from wrangler.jsonc
export interface Env {
  MCP_OBJECT: DurableObjectNamespace;
  OAUTH_KV: KVNamespace;
  SESSION_CACHE: KVNamespace;
  XANO_BASE_URL: string;
  COOKIE_ENCRYPTION_KEY: string;
  OAUTH_TOKEN_TTL?: string;
  FRESHBOOKS_ACCOUNT_ID: string;  // Your FreshBooks account ID
}

// Clean up expired auth tokens
async function deleteAllAuthTokens(env: Env): Promise<number> {
  let deletedCount = 0;
  
  const tokenEntries = await env.OAUTH_KV.list({ prefix: 'token:' });
  for (const key of tokenEntries.keys || []) {
    await env.OAUTH_KV.delete(key.name);
    deletedCount++;
  }
  
  const xanoAuthEntries = await env.OAUTH_KV.list({ prefix: 'xano_auth_token:' });
  for (const key of xanoAuthEntries.keys || []) {
    await env.OAUTH_KV.delete(key.name);
    deletedCount++;
  }
  
  return deletedCount;
}

export class MyMCP extends McpAgent<Env, unknown, XanoAuthProps> {
  server = new McpServer({
    name: "FreshBooks MCP Server",
    version: "1.0.0",
  });

  async getFreshApiKey(): Promise<string | null> {
    // This method returns the API key from OAuth props
    // The key is set during authentication in xano-handler.ts
    console.log("getFreshApiKey called with props:", {
      userId: this.props?.userId,
      email: this.props?.email,
      hasApiKey: !!this.props?.apiKey,
      apiKeyPrefix: this.props?.apiKey ? this.props.apiKey.substring(0, 20) + "..." : null
    });
    return this.props?.apiKey || null;
  }

  async getFreshBooksKey(): Promise<string | null> {
    // Returns FreshBooks API key from user's Xano account
    console.log("getFreshBooksKey called with props:", {
      userId: this.props?.userId,
      email: this.props?.email,
      hasFreshBooksKey: !!this.props?.freshbooksKey,
      freshbooksKeyPrefix: this.props?.freshbooksKey ? this.props.freshbooksKey.substring(0, 20) + "..." : null
    });
    return this.props?.freshbooksKey || null;
  }

  // Helper method to make authenticated API requests
  async makeAuthenticatedRequest(url: string, method = "GET", data?: any): Promise<any> {
    const token = await this.getFreshApiKey();
    if (!token) {
      throw new Error("No API key available");
    }
    // Pass userId for proper user-scoped token refresh
    return makeApiRequest(url, token, method, data, this.env, this.props?.userId);
  }

  async init() {
    
    // ===== Tool 1: List Invoices =====
    this.server.tool(
      "freshbooks_list_invoices",
      {
        status: z.enum(["draft", "sent", "viewed", "paid", "auto-paid", "retry", "failed", "partial"]).optional().describe("Filter by invoice status"),
        page: z.number().optional().default(1).describe("Page number for pagination")
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

    // ===== Tool 2: Send Saturday Invoices =====
    this.server.tool(
      "freshbooks_send_saturday_invoices",
      {
        dry_run: z.boolean().default(true).describe("Preview without sending (default: true)")
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

    // ===== Tool 3: Log Time Entry =====
    this.server.tool(
      "freshbooks_log_time",
      {
        client_name: z.string().describe("Client name"),
        hours: z.number().describe("Hours worked"),
        description: z.string().describe("Work description"),
        date: z.string().optional().describe("Date (YYYY-MM-DD), defaults to today")
      },
      async ({ client_name, hours, description, date }) => {
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
          // First, find the client
          const clientsResponse = await fetch(
            `https://api.freshbooks.com/accounting/account/${this.env.FRESHBOOKS_ACCOUNT_ID}/users/clients?search[organization]=${encodeURIComponent(client_name)}`,
            {
              headers: {
                "Authorization": `Bearer ${freshbooksKey}`,
                "Api-Version": "alpha"
              }
            }
          );

          const clientsData = await clientsResponse.json();
          const client = clientsData.clients?.[0];
          
          if (!client) {
            return new SmartError(
              "Client not found",
              `Could not find client "${client_name}"`,
              { tip: "Check the client name and try again" }
            ).toMCPResponse();
          }

          // Create time entry
          const timeEntry = {
            time_entry: {
              client_id: client.id,
              duration: hours * 3600, // Convert hours to seconds
              note: description,
              started_at: `${date || new Date().toISOString().split('T')[0]}T09:00:00Z`
            }
          };

          const response = await fetch(
            `https://api.freshbooks.com/accounting/account/${this.env.FRESHBOOKS_ACCOUNT_ID}/time_entries`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${freshbooksKey}`,
                "Api-Version": "alpha",
                "Content-Type": "application/json"
              },
              body: JSON.stringify(timeEntry)
            }
          );

          if (!response.ok) {
            throw new Error(`Failed to create time entry: ${response.status}`);
          }

          return {
            content: [{
              type: "text",
              text: `⏱️ Time Entry Created\n\nClient: ${client_name}\nHours: ${hours}\nDescription: ${description}\nDate: ${date || 'Today'}`
            }]
          };
        } catch (error) {
          return new SmartError(
            "Failed to log time",
            error.message
          ).toMCPResponse();
        }
      }
    );

    // ===== Tool 4: Debug/Connection Status =====
    this.server.tool(
      "debug_auth_status",
      {},
      async () => {
        // This tool doesn't require authentication - useful for debugging
        const authInfo = {
          authenticated: this.props?.authenticated || false,
          userId: this.props?.userId || "none",
          email: this.props?.email || "none",
          hasXanoApiKey: !!this.props?.apiKey,
          hasFreshBooksKey: !!this.props?.freshbooksKey,
          timestamp: new Date().toISOString()
        };

        return {
          content: [{
            type: "text",
            text: `🔍 Authentication Status\n${JSON.stringify(authInfo, null, 2)}`
          }]
        };
      }
    );

    // ===== Tool 5: Get Revenue Report =====
    this.server.tool(
      "freshbooks_revenue_report",
      {
        start_date: z.string().optional().describe("Start date (YYYY-MM-DD)"),
        end_date: z.string().optional().describe("End date (YYYY-MM-DD)")
      },
      async ({ start_date, end_date }) => {
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
          // Default to current month if no dates provided
          const now = new Date();
          const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
          const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
          
          const url = new URL(`https://api.freshbooks.com/accounting/account/${this.env.FRESHBOOKS_ACCOUNT_ID}/reports/accounting`);
          url.searchParams.set("start_date", start_date || defaultStart);
          url.searchParams.set("end_date", end_date || defaultEnd);

          const response = await fetch(url.toString(), {
            headers: {
              "Authorization": `Bearer ${freshbooksKey}`,
              "Api-Version": "alpha"
            }
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch report: ${response.status}`);
          }

          const data = await response.json();
          
          return {
            content: [{
              type: "text",
              text: `📊 Revenue Report (${start_date || defaultStart} to ${end_date || defaultEnd})\n\nTotal Revenue: $${data.total_revenue || 0}\nTotal Invoiced: $${data.total_invoiced || 0}\nOutstanding: $${data.total_outstanding || 0}`
            }]
          };
        } catch (error) {
          return new SmartError(
            "Failed to generate report",
            error.message
          ).toMCPResponse();
        }
      }
    );
  }
}

// Export required handlers for Cloudflare Workers
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { default: xanoHandler } = await import('./xano-handler');
    return xanoHandler.fetch(request, env);
  }
};

// Durable Object export
export { MyMCP };