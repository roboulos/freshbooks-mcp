# Remaining Xano Tools to Implement

This document outlines the remaining tools from the Python SDK that still need to be implemented in the TypeScript MCP server.

## File Management Tools

### `xano_list_files`
List files within a workspace.

**Parameters:**
- `instance_name`: The name of the Xano instance
- `workspace_id`: The ID of the workspace
- `page`: Page number (default: 1)
- `per_page`: Number of files per page (default: 50)
- `search`: Search term for filtering files
- `access`: Filter by access level ("public" or "private")
- `sort`: Field to sort by ("created_at", "name", "size", "mime")
- `order`: Sort order ("asc" or "desc")

### `xano_get_file_details`
Get details for a specific file.

**Parameters:**
- `instance_name`: The name of the Xano instance
- `workspace_id`: The ID of the workspace
- `file_id`: The ID of the file

### `xano_delete_file`
Delete a file from a workspace.

**Parameters:**
- `instance_name`: The name of the Xano instance
- `workspace_id`: The ID of the workspace
- `file_id`: The ID of the file to delete

### `xano_bulk_delete_files`
Delete multiple files from a workspace in a single operation.

**Parameters:**
- `instance_name`: The name of the Xano instance
- `workspace_id`: The ID of the workspace
- `file_ids`: List of file IDs to delete

## API Management Tools

### `xano_browse_api_groups`
Browse API groups in a workspace.

**Parameters:**
- `instance_name`: The name of the Xano instance
- `workspace_id`: The ID of the workspace
- `branch`: Filter by branch name
- `page`: Page number (default: 1)
- `per_page`: Number of results per page (default: 50)
- `search`: Search term for filtering API groups
- `sort`: Field to sort by ("created_at", "updated_at", "name")
- `order`: Sort order ("asc" or "desc")

### `xano_get_api_group`
Get details for a specific API group.

**Parameters:**
- `instance_name`: The name of the Xano instance
- `workspace_id`: The ID of the workspace
- `apigroup_id`: The ID of the API group

### `xano_create_api_group`
Create a new API group in a workspace.

**Parameters:**
- `instance_name`: The name of the Xano instance
- `workspace_id`: The ID of the workspace
- `name`: The name of the new API group
- `description`: API group description
- `docs`: Documentation text
- `branch`: Branch to create the API group in
- `swagger`: Whether to enable Swagger documentation
- `tag`: List of tags for the API group

### `xano_update_api_group`
Update an existing API group in a workspace.

**Parameters:**
- `instance_name`: The name of the Xano instance
- `workspace_id`: The ID of the workspace
- `apigroup_id`: The ID of the API group to update
- `name`: The new name of the API group
- `description`: New API group description
- `docs`: New documentation text
- `swagger`: Whether to enable Swagger documentation
- `tag`: New list of tags for the API group

### `xano_delete_api_group`
Delete an API group from a workspace.

**Parameters:**
- `instance_name`: The name of the Xano instance
- `workspace_id`: The ID of the workspace
- `apigroup_id`: The ID of the API group to delete

### `xano_update_api_group_security`
Update the security settings for an API group.

**Parameters:**
- `instance_name`: The name of the Xano instance
- `workspace_id`: The ID of the workspace
- `apigroup_id`: The ID of the API group
- `guid`: The new GUID for the API group
- `canonical`: The canonical URL for the API group

### `xano_browse_apis_in_group`
Browse APIs within a specific API group.

**Parameters:**
- `instance_name`: The name of the Xano instance
- `workspace_id`: The ID of the workspace
- `apigroup_id`: The ID of the API group
- `page`: Page number (default: 1)
- `per_page`: Number of APIs per page (default: 50)
- `search`: Search term for filtering APIs
- `sort`: Field to sort by ("created_at", "updated_at", "name")
- `order`: Sort order ("asc" or "desc")

### `xano_get_api`
Get details for a specific API.

**Parameters:**
- `instance_name`: The name of the Xano instance
- `workspace_id`: The ID of the workspace
- `apigroup_id`: The ID of the API group
- `api_id`: The ID of the API

### `xano_create_api`
Create a new API within an API group.

**Parameters:**
- `instance_name`: The name of the Xano instance
- `workspace_id`: The ID of the workspace
- `apigroup_id`: The ID of the API group
- `name`: The name of the new API
- `description`: API description
- `docs`: Documentation text
- `verb`: HTTP method (GET, POST, PUT, DELETE, PATCH, HEAD)
- `tag`: List of tags for the API

### `xano_update_api`
Update an existing API.

**Parameters:**
- `instance_name`: The name of the Xano instance
- `workspace_id`: The ID of the workspace
- `apigroup_id`: The ID of the API group
- `api_id`: The ID of the API to update
- `name`: The new name of the API
- `description`: New API description
- `docs`: New documentation text
- `verb`: New HTTP method
- `auth`: Authentication settings
- `tag`: New list of tags for the API
- `cache`: Cache settings

### `xano_delete_api`
Delete an API from an API group.

**Parameters:**
- `instance_name`: The name of the Xano instance
- `workspace_id`: The ID of the workspace
- `apigroup_id`: The ID of the API group
- `api_id`: The ID of the API to delete

### `xano_update_api_security`
Update the security settings for an API.

**Parameters:**
- `instance_name`: The name of the Xano instance
- `workspace_id`: The ID of the workspace
- `apigroup_id`: The ID of the API group
- `api_id`: The ID of the API
- `guid`: The new GUID for the API

## Export and History Tools

### `xano_export_workspace`
Export a workspace to a file.

**Parameters:**
- `instance_name`: The name of the Xano instance
- `workspace_id`: The ID of the workspace to export
- `branch`: Branch to export (defaults to live branch if not specified)
- `password`: Password to encrypt the export (optional)

### `xano_export_workspace_schema`
Export only the schema of a workspace to a file.

**Parameters:**
- `instance_name`: The name of the Xano instance
- `workspace_id`: The ID of the workspace
- `branch`: Branch to export (defaults to live branch if not specified)
- `password`: Password to encrypt the export (optional)

### `xano_browse_request_history`
Browse request history for a workspace.

**Parameters:**
- `instance_name`: The name of the Xano instance
- `workspace_id`: The ID of the workspace
- `page`: Page number (default: 1)
- `per_page`: Number of results per page (default: 50)
- `branch`: Filter by branch
- `api_id`: Filter by API ID
- `query_id`: Filter by query ID
- `include_output`: Whether to include response output

## Implementation Strategy

To implement these remaining tools:

1. Follow the same pattern used in `xano-tools.ts`
2. Create the helper functions for API path construction
3. Add authentication checks
4. Make API requests and handle responses
5. Test each tool with a real Xano instance

The implementation can be added to the existing `xano-tools.ts` file, or created in separate files based on categories if you prefer organization by feature.