# Phase 1 Implementation: Directory Structure and Foundation

This document outlines the detailed implementation steps for Phase 1 of the Xano tools integration plan.

## 1. Directory Structure Setup

Create the following directory structure:

```
src/
  tools/               # New directory for all tools
    index.ts           # Exports all tools
    table-tools.ts     # Table management tools
    schema-tools.ts    # Schema management tools
    record-tools.ts    # Record management tools
    bulk-tools.ts      # Bulk operations
    index-tools.ts     # Index management
    file-tools.ts      # File operations
    api-tools.ts       # API management
    export-tools.ts    # Export/import operations
```

### Implementation Steps:

1. Create the tools directory:
```bash
mkdir -p src/tools
```

2. Create the index.ts file that will export all tools:

```typescript
// src/tools/index.ts
export * from './table-tools';
export * from './schema-tools';
export * from './record-tools';
export * from './bulk-tools';
export * from './index-tools';
export * from './file-tools';
export * from './api-tools';
export * from './export-tools';
```

3. Create placeholder files for each category:
```bash
touch src/tools/table-tools.ts
touch src/tools/schema-tools.ts
touch src/tools/record-tools.ts
touch src/tools/bulk-tools.ts
touch src/tools/index-tools.ts
touch src/tools/file-tools.ts
touch src/tools/api-tools.ts
touch src/tools/export-tools.ts
```

## 2. Utility Functions Enhancement

Enhance the utility functions in utils.ts to handle the new tools:

1. Add new utility functions for creating structured API paths

```typescript
// Additional utility functions to add to src/utils.ts

// Get table API path
export function getTableApiPath(
  instance: string, 
  workspace: string | number, 
  table?: string | number
): string {
  const metaApi = getMetaApiUrl(instance);
  const workspaceId = formatId(workspace);
  
  if (table) {
    const tableId = formatId(table);
    return `${metaApi}/workspace/${workspaceId}/table/${tableId}`;
  }
  
  return `${metaApi}/workspace/${workspaceId}/table`;
}

// Get schema API path
export function getSchemaApiPath(
  instance: string, 
  workspace: string | number, 
  table: string | number
): string {
  const metaApi = getMetaApiUrl(instance);
  const workspaceId = formatId(workspace);
  const tableId = formatId(table);
  
  return `${metaApi}/workspace/${workspaceId}/table/${tableId}/schema`;
}

// Get records API path
export function getRecordsApiPath(
  instance: string, 
  workspace: string | number, 
  table: string | number,
  record?: string | number
): string {
  const metaApi = getMetaApiUrl(instance);
  const workspaceId = formatId(workspace);
  const tableId = formatId(table);
  
  if (record) {
    const recordId = formatId(record);
    return `${metaApi}/workspace/${workspaceId}/table/${tableId}/row/${recordId}`;
  }
  
  return `${metaApi}/workspace/${workspaceId}/table/${tableId}/row`;
}

// Helper for standardized authentication checks
export function checkAuthentication(props: any): { 
  isAuthenticated: boolean;
  apiKey?: string;
  errorContent?: { type: string; text: string }[];
} {
  const isAuthenticated = props?.authenticated || props?.user?.authenticated;
  
  if (!isAuthenticated) {
    return {
      isAuthenticated: false,
      errorContent: [{ 
        type: "text", 
        text: "Authentication required to use this tool." 
      }]
    };
  }
  
  const apiKey = props?.apiKey || props?.user?.apiKey;
  
  if (!apiKey) {
    return {
      isAuthenticated: true,
      errorContent: [{ 
        type: "text", 
        text: "API key not available. Please ensure you are authenticated." 
      }]
    };
  }
  
  return {
    isAuthenticated: true,
    apiKey
  };
}

// Helper for standardized error response
export function createErrorResponse(message: string): { 
  content: { type: string; text: string }[] 
} {
  return {
    content: [{ 
      type: "text", 
      text: `Error: ${message}` 
    }]
  };
}

// Helper for standardized success response
export function createSuccessResponse(data: any): { 
  content: { type: string; text: string }[] 
} {
  return {
    content: [{ 
      type: "text", 
      text: JSON.stringify(data) 
    }]
  };
}
```

## 3. Tool Registration Pattern

Create a standardized pattern for registering tools in the MyMCP class:

1. Move the existing tools from my-mcp.ts to their respective category files
2. Implement a registration mechanism to keep the code modular

```typescript
// src/tools/table-tools.ts
import { z } from "zod";
import { getTableApiPath, makeApiRequest, checkAuthentication, createErrorResponse, createSuccessResponse } from "../utils";

// Export a function that will register all table tools
export function registerTableTools(server: any, props: any) {
  // xano_list_tables (moved from my-mcp.ts)
  server.tool(
    "xano_list_tables",
    {
      instance_name: z.string().describe("The name of the Xano instance"),
      database_id: z.union([z.string(), z.number()]).describe("The ID of the Xano workspace/database")
    },
    async ({ instance_name, database_id }) => {
      const auth = checkAuthentication(props);
      if (!auth.isAuthenticated || auth.errorContent) {
        return { content: auth.errorContent };
      }

      try {
        const url = getTableApiPath(instance_name, database_id);
        const result = await makeApiRequest(url, auth.apiKey);

        if (result.error) {
          return createErrorResponse(result.error);
        }

        return createSuccessResponse({ tables: result });
      } catch (error) {
        console.error(`Error listing tables: ${error.message}`);
        return createErrorResponse(`Error listing tables: ${error.message}`);
      }
    }
  );

  // Add xano_get_table_details
  server.tool(
    "xano_get_table_details",
    {
      instance_name: z.string().describe("The name of the Xano instance"),
      workspace_id: z.union([z.string(), z.number()]).describe("The ID of the workspace"),
      table_id: z.union([z.string(), z.number()]).describe("The ID of the table")
    },
    async ({ instance_name, workspace_id, table_id }) => {
      const auth = checkAuthentication(props);
      if (!auth.isAuthenticated || auth.errorContent) {
        return { content: auth.errorContent };
      }

      try {
        const url = getTableApiPath(instance_name, workspace_id, table_id);
        const result = await makeApiRequest(url, auth.apiKey);

        if (result.error) {
          return createErrorResponse(result.error);
        }

        return createSuccessResponse(result);
      } catch (error) {
        console.error(`Error getting table details: ${error.message}`);
        return createErrorResponse(`Error getting table details: ${error.message}`);
      }
    }
  );

  // Add more table tools here...
}
```

## 4. Update MyMCP Class

Modify the MyMCP class to use the new modular pattern:

```typescript
// src/my-mcp.ts (updated)
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, getMetaApiUrl, formatId } from "./utils";
import { registerTableTools } from "./tools/table-tools";
import { registerSchemaTools } from "./tools/schema-tools";
import { registerRecordTools } from "./tools/record-tools";
import { registerBulkTools } from "./tools/bulk-tools";
import { registerIndexTools } from "./tools/index-tools";
import { registerFileTools } from "./tools/file-tools";
import { registerApiTools } from "./tools/api-tools";
import { registerExportTools } from "./tools/export-tools";

// Interface for authentication properties
export interface AuthProps {
  apiKey?: string;
  userId?: string;
  authenticated?: boolean;
  user?: {
    id: string;
    authenticated: boolean;
    apiKey?: string;
  };
  [key: string]: unknown; // For compatibility with McpAgent
}

// MCP Agent implementation with Xano tools
export class MyMCP extends McpAgent<Env, unknown, AuthProps> {
  server = new McpServer({
    name: "Snappy MCP Server",
    version: "1.0.0",
  });
  
  async init() {
    // Debug tool to see what props are available
    this.server.tool(
      "debug_auth",
      {},
      async () => {
        return {
          content: [{ 
            type: "text", 
            text: "Auth debug info: " + JSON.stringify({
              // Check both user and direct props structure
              hasUser: !!this.props?.user,
              userKeys: this.props?.user ? Object.keys(this.props.user) : null,
              apiKey: this.props?.apiKey || this.props?.user?.apiKey,
              userId: this.props?.userId || this.props?.user?.id,
              authenticated: this.props?.authenticated || this.props?.user?.authenticated,
              allProps: this.props
            }, null, 2)
          }]
        };
      }
    );

    // Register hello tool
    this.server.tool(
      "hello",
      { name: z.string() },
      async ({ name }) => {
        // Check authentication using either direct props or user object
        if (!(this.props?.authenticated || this.props?.user?.authenticated)) {
          return {
            content: [{ type: "text", text: "Authentication required to use this tool." }]
          };
        }

        const userId = this.props?.userId || this.props?.user?.id;
        return {
          content: [{ type: "text", text: `Hello, ${name}! You are authenticated as ${userId}.` }]
        };
      }
    );

    // Register all tool categories
    registerTableTools(this.server, this.props);
    registerSchemaTools(this.server, this.props);
    registerRecordTools(this.server, this.props);
    registerBulkTools(this.server, this.props);
    registerIndexTools(this.server, this.props);
    registerFileTools(this.server, this.props);
    registerApiTools(this.server, this.props);
    registerExportTools(this.server, this.props);
  }
}

// For TypeScript
export interface Env {
  MCP_OBJECT: DurableObjectNamespace;
  OAUTH_KV: KVNamespace;
  XANO_BASE_URL: string;
  OAUTH_PROVIDER?: any;
}
```

## 5. Implementation of First Tool Category - Table Tools

Implement the first category of tools (Table Management) in the `table-tools.ts` file:

- `xano_list_tables`
- `xano_get_table_details`
- `xano_create_table`
- `xano_update_table`
- `xano_delete_table`
- `xano_get_table_schema`

This will serve as a template for the other categories.

## 6. Testing

Create a simple way to test the implementation:

1. Start the dev server:
```bash
npm run dev
```

2. Test each tool with a valid Xano instance and credentials
3. Verify that error handling works correctly
4. Document any issues or adjustments needed

## Next Steps After Phase 1

Once the directory structure and table tools are implemented:

1. Move on to implementing schema management tools
2. Continue with the other categories in order of priority
3. Update the documentation as needed