# Xano Tools Integration Documentation

This document provides information about the Xano tools integration with Cloudflare Workers MCP Server. It covers the available tools, authentication mechanism, and usage guidelines.

## Authentication Mechanism

The Xano tools integration uses API key authentication, obtained via the OAuth flow:

1. User authenticates through the Xano OAuth flow
2. On successful authentication, the server receives an API key with prefix `eyJhbGciOiJSUzI1NiJ9...`
3. This API key is stored in the KV storage and made available to all tools through `this.props.apiKey`
4. Authentication is verified before each tool operation

## Available Tools

### Working Tools

#### `xano_list_instances`
Lists all available Xano instances.
- Parameters: None
- Example response: `{"instances": [{"name": "xnwv-v1z6-dvnr", ...}]}`

#### `xano_get_instance_details`
Get details for a specific Xano instance.
- Parameters:
  - `instance_name`: String - The name of the Xano instance
- Example response: `{"name": "xnwv-v1z6-dvnr", "display": "XNWV", "xano_domain": "xnwv-v1z6-dvnr.n7c.xano.io", ...}`

#### `xano_list_databases`
Lists all databases in a Xano instance.
- Parameters:
  - `instance_name`: String - The name of the Xano instance
- Example response: `{"databases": [{"id": 1, "name": "Main Database", ...}]}`

#### `xano_list_tables`
Lists all tables in a Xano database.
- Parameters:
  - `instance_name`: String - The name of the Xano instance
  - `database_id`: String/Number - The ID of the Xano workspace/database
- Example response: `{"tables": [{"id": 1, "name": "Users", ...}]}`

#### `xano_get_table_details`
Get detailed information about a specific table.
- Parameters:
  - `instance_name`: String - The name of the Xano instance
  - `workspace_id`: String/Number - The ID of the workspace
  - `table_id`: String/Number - The ID of the table
- Example response: `{"id": 1, "name": "Users", "description": "User accounts", ...}`

#### `xano_get_table_schema`
Get the schema for a specific table.
- Parameters:
  - `instance_name`: String - The name of the Xano instance
  - `workspace_id`: String/Number - The ID of the workspace
  - `table_id`: String/Number - The ID of the table
- Example response: `{"success": true, "data": {"schema": [...]}}`

#### `xano_browse_table_content`
Browse the records in a table with pagination.
- Parameters:
  - `instance_name`: String - The name of the Xano instance
  - `workspace_id`: String/Number - The ID of the workspace
  - `table_id`: String/Number - The ID of the table
  - `page`: Number (optional) - Page number (default: 1)
  - `per_page`: Number (optional) - Number of records per page (default: 50)
- Example response: `{"records": [...], "meta": {"current_page": 1, "per_page": 50, ...}}`

### Table Modification Tools

#### `xano_create_table`
Create a new table in a workspace.
- Parameters:
  - `instance_name`: String - The name of the Xano instance
  - `workspace_id`: String/Number - The ID of the workspace
  - `name`: String - The name of the new table
  - `description`: String (optional) - Table description
  - `docs`: String (optional) - Documentation text
  - `auth`: Boolean (optional) - Whether authentication is required
  - `tag`: Array of Strings (optional) - List of tags for the table

#### `xano_update_table`
Update an existing table.
- Parameters:
  - `instance_name`: String - The name of the Xano instance
  - `workspace_id`: String/Number - The ID of the workspace
  - `table_id`: String/Number - The ID of the table to update
  - `name`: String (optional) - The new name of the table
  - `description`: String (optional) - New table description
  - `docs`: String (optional) - New documentation text
  - `auth`: Boolean (optional) - New authentication setting
  - `tag`: Array of Strings (optional) - New list of tags for the table

#### `xano_delete_table`
Delete a table.
- Parameters:
  - `instance_name`: String - The name of the Xano instance
  - `workspace_id`: String/Number - The ID of the workspace
  - `table_id`: String/Number - The ID of the table to delete

### Schema Modification Tools

#### `xano_add_field_to_schema`
Add a new field to a table schema.
- Parameters:
  - `instance_name`: String - The name of the Xano instance
  - `workspace_id`: String/Number - The ID of the workspace
  - `table_id`: String/Number - The ID of the table
  - `field_name`: String - The name of the new field
  - `field_type`: String - The type of the field (e.g., "text", "int", "decimal", "boolean", "date")
  - `description`: String (optional) - Field description
  - `nullable`: Boolean (optional) - Whether the field can be null
  - `default_value`: Any (optional) - Default value for the field
  - `required`: Boolean (optional) - Whether the field is required
  - `access`: String (optional) - Field access level ("public", "private", "internal")
  - `sensitive`: Boolean (optional) - Whether the field contains sensitive data
  - `style`: String (optional) - Field style ("single" or "list")
  - `validators`: Object (optional) - Validation rules specific to the field type

#### `xano_rename_schema_field`
Rename a field in the table schema.
- Parameters:
  - `instance_name`: String - The name of the Xano instance
  - `workspace_id`: String/Number - The ID of the workspace
  - `table_id`: String/Number - The ID of the table
  - `old_name`: String - The current name of the field
  - `new_name`: String - The new name for the field

#### `xano_delete_field`
Delete a field from the table schema.
- Parameters:
  - `instance_name`: String - The name of the Xano instance
  - `workspace_id`: String/Number - The ID of the workspace
  - `table_id`: String/Number - The ID of the table
  - `field_name`: String - The name of the field to delete

### Record Manipulation Tools

#### `xano_get_table_record`
Get a specific record from a table.
- Parameters:
  - `instance_name`: String - The name of the Xano instance
  - `workspace_id`: String/Number - The ID of the workspace
  - `table_id`: String/Number - The ID of the table
  - `record_id`: String/Number - The ID of the record to retrieve

#### `xano_create_table_record`
Create a new record in a table.
- Parameters:
  - `instance_name`: String - The name of the Xano instance
  - `workspace_id`: String/Number - The ID of the workspace
  - `table_id`: String/Number - The ID of the table
  - `record_data`: Object - The data for the new record

#### `xano_update_table_record`
Update an existing record.
- Parameters:
  - `instance_name`: String - The name of the Xano instance
  - `workspace_id`: String/Number - The ID of the workspace
  - `table_id`: String/Number - The ID of the table
  - `record_id`: String/Number - The ID of the record to update
  - `record_data`: Object - The updated data for the record

#### `xano_delete_table_record`
Delete a record from a table.
- Parameters:
  - `instance_name`: String - The name of the Xano instance
  - `workspace_id`: String/Number - The ID of the workspace
  - `table_id`: String/Number - The ID of the table
  - `record_id`: String/Number - The ID of the record to delete

### Bulk Operations

#### `xano_bulk_create_records`
Create multiple records at once.
- Parameters:
  - `instance_name`: String - The name of the Xano instance
  - `workspace_id`: String/Number - The ID of the workspace
  - `table_id`: String/Number - The ID of the table
  - `records`: Array of Objects - List of record data to insert
  - `allow_id_field`: Boolean (optional) - Whether to allow setting the ID field

#### `xano_bulk_update_records`
Update multiple records at once.
- Parameters:
  - `instance_name`: String - The name of the Xano instance
  - `workspace_id`: String/Number - The ID of the workspace
  - `table_id`: String/Number - The ID of the table
  - `updates`: Array of Objects - List of update operations, each containing:
    - `row_id`: String/Number - ID of the record to update
    - `updates`: Object - Fields to update and their new values

## Issues and Limitations

### Tools Requiring Additional Work

#### `xano_generate_endpoints`
This tool currently returns authentication errors and requires additional implementation:
- Error: `{"success":false,"error":{"message":"Authentication required to use this tool","code":"AUTH_REQUIRED"},"operation":"xano_generate_endpoints"}`
- This may require specialized authentication handling

## Authentication Refresh Implementation

The refresh token implementation provides a way to automatically refresh authentication credentials when needed:

1. The `refreshUserProfile` function in `refresh-profile.ts` handles:
   - Retrieving token information from KV storage
   - Calling the auth/me endpoint to get fresh data
   - Updating stored tokens with fresh API keys
   - Ensuring all tokens for the same user are updated

2. This refresh functionality integrates with the request flow through the `onNewRequest` method, which:
   - Runs before every request processing
   - Refreshes the profile data if the user is authenticated
   - Updates in-memory props with the latest API key

## Best Practices

When using Xano tools, follow these best practices:

1. Always check for authentication status before performing operations
2. Handle possible authentication failures gracefully
3. Use proper error handling for all API operations
4. Provide complete and valid parameters for each tool
5. When performing destructive operations (DELETE), confirm with the user first
6. Prefer bulk operations when updating multiple records for efficiency