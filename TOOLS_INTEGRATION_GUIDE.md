# Xano Tools Integration Guide

This guide explains how to integrate the additional Xano tools from `xano-tools.ts` into your existing MCP implementation.

## Overview

The `xano-tools.ts` file contains implementations for the following categories of tools:

1. **Table Management Tools**: Get, create, update, and delete Xano tables
2. **Schema Management Tools**: Add, rename, and delete fields in table schemas
3. **Record Management Tools**: Browse, search, get, create, update, and delete table records
4. **Bulk Operations Tools**: Bulk create, update, delete records, and truncate tables
5. **Index Management Tools**: List, create, and delete table indexes

## Integration Steps

### 1. Import the tools file

In your `my-mcp.ts` file, add an import for the tools:

```typescript
import { allXanoTools } from "./xano-tools";
```

### 2. Register the tools in the init function

In your `MyMCP` class's `init` method, add the following code to register all the tools:

```typescript
async init() {
  // Your existing tools...
  
  // Register all Xano tools
  for (const tool of allXanoTools) {
    this.server.tool(
      tool.name,
      tool.parameters,
      async (params) => {
        return await tool.handler(params, this.props);
      }
    );
  }
}
```

### 3. Alternative: Register individual tools

If you want more control over which tools to add, you can register them individually:

```typescript
import { 
  getTableDetails, 
  getTableSchema,
  createTable,
  // other tools you want to import...
} from "./xano-tools";

async init() {
  // Your existing tools...
  
  // Register specific tools
  this.server.tool(
    getTableDetails.name,
    getTableDetails.parameters,
    async (params) => {
      return await getTableDetails.handler(params, this.props);
    }
  );
  
  this.server.tool(
    getTableSchema.name,
    getTableSchema.parameters,
    async (params) => {
      return await getTableSchema.handler(params, this.props);
    }
  );
  
  this.server.tool(
    createTable.name,
    createTable.parameters,
    async (params) => {
      return await createTable.handler(params, this.props);
    }
  );
  
  // Add other tools as needed...
}
```

## Example Integration

Here's a complete example of how your `init` method might look after integration:

```typescript
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
  
  // Your other existing tools...
  
  // Register all Xano tools
  for (const tool of allXanoTools) {
    this.server.tool(
      tool.name,
      tool.parameters,
      async (params) => {
        return await tool.handler(params, this.props);
      }
    );
  }
}
```

## Available Tools

All tools follow the Xano API naming convention and are prefixed with `xano_`:

### Table Management
- `xano_get_table_details`
- `xano_create_table`
- `xano_update_table`
- `xano_delete_table`
- `xano_get_table_schema`

### Schema Management
- `xano_add_field_to_schema`
- `xano_rename_schema_field`
- `xano_delete_field`

### Record Management
- `xano_browse_table_content`
- `xano_search_table_content`
- `xano_get_table_record`
- `xano_create_table_record`
- `xano_update_table_record`
- `xano_delete_table_record`

### Bulk Operations
- `xano_bulk_create_records`
- `xano_bulk_update_records`
- `xano_bulk_delete_records`
- `xano_truncate_table`

### Index Management
- `xano_list_indexes`
- `xano_create_btree_index`
- `xano_create_unique_index`
- `xano_create_search_index`
- `xano_delete_index`

## Next Steps and Additional Tools

To complete the implementation of all tools from the Python SDK, you can extend the `xano-tools.ts` file to include:

1. **File Management Tools**:
   - `xano_list_files`
   - `xano_get_file_details`
   - `xano_delete_file`
   - `xano_bulk_delete_files`

2. **API Management Tools**:
   - `xano_browse_api_groups`
   - `xano_get_api_group`
   - `xano_create_api_group`
   - `xano_update_api_group`
   - `xano_delete_api_group`
   - And other API-related tools

3. **Export Operations**:
   - `xano_export_workspace`
   - `xano_export_workspace_schema`
   - `xano_browse_request_history`

The implementation pattern will be the same as the tools already provided in `xano-tools.ts`.

## Testing

When testing the integration, make sure you have:

1. A valid Xano instance to connect to
2. Authentication credentials (username/password or API key)
3. Test each tool with proper permissions

## Troubleshooting

- If you encounter authentication issues, use the `debug_auth` tool to check the props being passed to the handlers
- To debug API calls, check the console logs for error messages
- Make sure the authentication token has the necessary permissions for the operations you're performing