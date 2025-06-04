import { describe, it, expect } from 'vitest';
import { ultimateFormatChecker } from '../test-utils/format-checker';

// Define the expected format for all responses
const EXPECTED_FORMAT_REGEX = /^(🏢|🎯|📁|✨|✏️|🔌|📤|🗑️|🌿|📊|💾|🏗️|🗂️|📋|🔧|📊|➕|📄|🧹|🔐|⚡|🚀|🔍|⏰|🔄|📜|🧱|👤|👋|❌|📝).+ - .+\n={50}\n/;

describe('Ultimate Format Tests for All 69 Xano Tools', () => {
  
  // Test data for each tool type
  const mockResponses = {
    // List tools
    xano_list_instances: {
      success: [{ instance_name: 'test.xano.io', domain: 'test.xano.io', id: 1 }],
      error: 'Authentication required'
    },
    xano_browse_api_groups: {
      success: { items: [{id: 1, name: 'Test Group'}], curPage: 1, totPage: 3, totItems: 45 },
      error: 'Invalid workspace'
    },
    xano_list_databases: {
      success: { databases: [{id: 1, name: 'Production'}] },
      error: 'API key invalid'
    },
    xano_list_tables: {
      success: { tables: { items: [{id: 1, name: 'users'}], curPage: 1, totPage: 2 } },
      error: 'Workspace not found'
    },
    xano_list_files: {
      success: { items: [{id: 1, name: 'logo.png', size: 12345}], curPage: 1, totPage: 5 },
      error: 'Permission denied'
    },
    xano_list_functions: {
      success: { data: { items: [{id: 1, name: 'calculate_tax'}], curPage: 1, totPage: 2 } },
      error: 'Invalid branch'
    },
    xano_list_tasks: {
      success: { data: { items: [{id: 1, name: 'daily_sync', active: true}], curPage: 1, totPage: 1 } },
      error: 'Tasks not enabled'
    },
    xano_list_workspace_branches: {
      success: [{ name: 'main', is_live: true }, { name: 'dev', is_live: false }],
      error: 'Branch access denied'
    },
    xano_browse_request_history: {
      success: { items: [{id: 1, timestamp: '2024-01-01', status: 200}], curPage: 1, totPage: 10 },
      error: 'History not available'
    },
    xano_list_apis_with_logic: {
      success: { data: { items: [{id: 1, name: 'get_user', verb: 'GET'}], curPage: 1, totPage: 3 } },
      error: 'Group not found'
    },
    
    // Get/Details tools
    xano_get_instance_details: {
      success: { display: 'Test Instance', rate_limit: 1000, id: 1 },
      error: 'Instance not found'
    },
    xano_get_workspace_details: {
      success: { name: 'Production', id: 1, branch: 'main' },
      error: 'Workspace not found'
    },
    xano_get_table_details: {
      success: { name: 'users', id: 1, auth: true },
      error: 'Table not found'
    },
    xano_get_table_schema: {
      success: { data: { schema: [{name: 'id', type: 'int'}, {name: 'email', type: 'email'}], table_id: 1 } },
      error: 'Schema unavailable'
    },
    xano_get_api_group: {
      success: { name: 'User Management', tag: ['auth', 'users'], swagger: true, id: 1 },
      error: 'Group not found'
    },
    xano_get_api: {
      success: { name: 'get_user', verb: 'GET', path: '/user/{id}', input: [{name: 'id', type: 'int'}], id: 1 },
      error: 'API not found'
    },
    xano_get_function_details: {
      success: { name: 'calculate_tax', id: 1, _draft_last_update: 123456789 },
      error: 'Function not found'
    },
    xano_get_task_details: {
      success: { name: 'daily_sync', id: 1, active: true, _draft_last_update: null },
      error: 'Task not found'
    },
    xano_get_table_record: {
      success: { id: 1, email: 'test@example.com', name: 'Test User' },
      error: 'Record not found'
    },
    xano_get_api_with_logic: {
      success: { name: 'create_user', verb: 'POST', input: [{name: 'email'}, {name: 'password'}], _draft_last_update: 123456789 },
      error: 'Logic not found'
    },
    
    // Create tools
    xano_create_table: {
      success: { id: 123, name: 'orders', workspace_id: 456 },
      error: 'Table name already exists'
    },
    xano_create_api_group: {
      success: { id: 789, name: 'Payment APIs' },
      error: 'Invalid group name'
    },
    xano_create_api: {
      success: { id: 111, name: 'process_payment', verb: 'POST', auth: true },
      error: 'Path already exists'
    },
    xano_create_table_record: {
      success: { data: { id: 999, email: 'new@example.com', created_at: '2024-01-01' } },
      error: 'Validation failed'
    },
    xano_create_function: {
      success: { data: { id: 222, name: 'send_email', _draft_last_update: 123456789 } },
      error: 'Invalid function syntax'
    },
    xano_create_task: {
      success: { data: { id: 333, name: 'cleanup_task', active: false } },
      error: 'Task name duplicate'
    },
    xano_create_api_with_logic: {
      success: { data: { id: 444, name: 'complex_api', verb: 'PUT', input: [{name: 'data'}] } },
      error: 'Script compilation failed'
    },
    xano_create_btree_index: {
      success: { data: { id: 555, fields: [{name: 'email', op: 'asc'}] } },
      error: 'Index already exists'
    },
    xano_create_search_index: {
      success: { name: 'user_search', fields: [{name: 'name', priority: 1}, {name: 'email', priority: 2}], table_id: 123 },
      error: 'Invalid field type'
    },
    xano_create_table_with_script: {
      success: { name: 'products', field_count: 8 },
      error: 'Script syntax error'
    },
    
    // Update tools
    xano_update_table: {
      success: { table_id: 123, updated_at: '2024-01-01T12:00:00Z' },
      error: 'Update failed'
    },
    xano_update_api_group: {
      success: { api_group_id: 456, updated_at: '2024-01-01T12:00:00Z' },
      error: 'Group locked'
    },
    xano_update_api: {
      success: { api_id: 789, updated_at: '2024-01-01T12:00:00Z' },
      error: 'API in use'
    },
    xano_update_table_record: {
      success: { id: 999, fields_changed: ['email', 'name', 'updated_at'] },
      error: 'Record locked'
    },
    xano_update_function: {
      success: { function_id: 111, draft_created: true },
      error: 'Function protected'
    },
    xano_update_task: {
      success: { task_id: 222, draft_created: true },
      error: 'Task running'
    },
    xano_update_api_with_logic: {
      success: { api_id: 333, draft_saved: true },
      error: 'Logic invalid'
    },
    xano_update_table_with_script: {
      success: { table_id: 444, script_applied: true },
      error: 'Migration failed'
    },
    
    // Delete tools
    xano_delete_table: {
      success: { table_id: 123, workspace_id: 456 },
      error: 'Table has records'
    },
    xano_delete_api_group: {
      success: { api_group_id: 789, workspace_id: 456 },
      error: 'Group has APIs'
    },
    xano_delete_api: {
      success: { api_id: 111, api_group_id: 789 },
      error: 'API in use'
    },
    xano_delete_table_record: {
      success: { record_id: 999, table_id: 123 },
      error: 'Record protected'
    },
    xano_delete_function: {
      success: { function_id: 222, workspace_id: 456 },
      error: 'Function in use'
    },
    xano_delete_task: {
      success: { task_id: 333, workspace_id: 456 },
      error: 'Task active'
    },
    xano_delete_file: {
      success: { file_id: 444, workspace_id: 456 },
      error: 'File in use'
    },
    xano_delete_field: {
      success: { field_name: 'old_field', table_id: 123 },
      error: 'Field required'
    },
    xano_delete_workspace_branch: {
      success: { branch_name: 'feature-x', workspace_id: 456 },
      error: 'Branch is live'
    },
    
    // Bulk operations
    xano_bulk_create_records: {
      success: { data: [1, 2, 3, 4, 5] },
      error: 'Bulk insert failed'
    },
    xano_bulk_update_records: {
      success: { data: { update_count: 10, updated_records: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } },
      error: 'Bulk update failed'
    },
    
    // Special operations
    xano_add_field_to_schema: {
      success: { field_name: 'status', field_type: 'enum', table_id: 123 },
      error: 'Field exists'
    },
    xano_rename_schema_field: {
      success: { old_name: 'usr_name', new_name: 'username', table_id: 123 },
      error: 'Field not found'
    },
    xano_browse_table_content: {
      success: { data: { items: [{id: 1}, {id: 2}], curPage: 1, totPage: 5, totItems: 100 } },
      error: 'Table empty'
    },
    xano_upload_file: {
      success: { name: 'document.pdf', size: 54321, id: 777 },
      error: 'Upload failed'
    },
    xano_truncate_table: {
      success: { table_id: 123, reset: true },
      error: 'Truncate failed'
    },
    xano_export_workspace: {
      success: { workspace_id: 456, include_data: false },
      error: 'Export failed'
    },
    xano_export_workspace_schema: {
      success: { workspace_id: 456, branch: 'main' },
      error: 'Schema export failed'
    },
    xano_publish_function: {
      success: { function_id: 888, status: 'live' },
      error: 'Publish failed'
    },
    xano_publish_api: {
      success: { api_id: 999, api_group_id: 111, status: 'live' },
      error: 'API has errors'
    },
    xano_publish_task: {
      success: { task_id: 222, active: true },
      error: 'Task invalid'
    },
    xano_activate_task: {
      success: { task_id: 333, active: true, draft_created: true },
      error: 'Activation failed'
    },
    xano_get_table_with_script: {
      success: { name: 'users', id: 123, script: 'table users { ... }' },
      error: 'Script unavailable'
    },
    xano_auth_me: {
      success: { name: 'John Doe', id: 1, email: 'john@example.com' },
      error: 'Not authenticated'
    },
    xano_get_function_template: {
      success: { function_name: 'db.query', template: 'db.query { ... }' },
      error: 'Template not found'
    },
    xano_get_block_template: {
      success: { block_name: 'stack', template: 'stack { ... }' },
      error: 'Block not found'
    },
    xano_get_started: {
      success: { guide: 'XanoScript quick start guide...' },
      error: 'Guide unavailable'
    },
    xano_validate_line: {
      success: { valid: true, context: 'inside stack block' },
      error: 'Syntax error'
    },
    whoami: {
      success: { userId: 'user123', authenticated: true },
      error: 'Not authenticated'
    },
    hello: {
      success: { greeting: 'Hello Test User', userId: 'user123' },
      error: 'User not found'
    },
    debug_expire_oauth_tokens: {
      success: { deleted: { oauth_tokens: 5, xano_auth_tokens: 3 } },
      error: 'Cleanup failed'
    },
    debug_list_active_sessions: {
      success: { sessionCount: 12, sessions: [] },
      error: 'Sessions unavailable'
    }
  };

  // Test each tool
  Object.entries(mockResponses).forEach(([toolName, mockData]) => {
    describe(`${toolName}`, () => {
      it('should format success response correctly', () => {
        const formattedResponse = ultimateFormatChecker.formatResponse(toolName, mockData.success);
        expect(formattedResponse).toMatch(EXPECTED_FORMAT_REGEX);
        expect(formattedResponse).toContain('==================================================');
      });

      it('should format error response correctly', () => {
        const formattedResponse = ultimateFormatChecker.formatError(toolName, mockData.error);
        expect(formattedResponse).toMatch(/^❌ .+ Failed - .+\n={50}\n/);
        expect(formattedResponse).toContain(mockData.error);
      });
    });
  });

  // Additional format consistency tests
  describe('Format Consistency', () => {
    it('should use consistent separator length', () => {
      const separator = '='.repeat(50);
      const response = ultimateFormatChecker.formatResponse('xano_list_instances', mockResponses.xano_list_instances.success);
      expect(response).toContain(separator);
    });

    it('should include key metrics in header', () => {
      // List operations should show count
      const listResponse = ultimateFormatChecker.formatResponse('xano_list_instances', mockResponses.xano_list_instances.success);
      expect(listResponse).toMatch(/\d+ instance\(s\) found/);

      // Create operations should show ID
      const createResponse = ultimateFormatChecker.formatResponse('xano_create_table', mockResponses.xano_create_table.success);
      expect(createResponse).toMatch(/ID: \d+/);

      // Update operations should show what changed
      const updateResponse = ultimateFormatChecker.formatResponse('xano_update_table_record', mockResponses.xano_update_table_record.success);
      expect(updateResponse).toMatch(/\d+ field\(s\) modified/);
    });

    it('should handle null and undefined values gracefully', () => {
      const responseWithNulls = ultimateFormatChecker.formatResponse('xano_get_task_details', {
        name: 'test',
        id: 1,
        active: null,
        _draft_last_update: undefined
      });
      // The header should not show raw null/undefined, but "N/A" instead
      const headerLine = responseWithNulls.split('\n')[0];
      expect(headerLine).toContain('Active: N/A');
      expect(headerLine).toContain('Draft: No');
      // The JSON output will still contain the raw values, which is correct
      expect(responseWithNulls).toContain('"active": null');
    });
  });
});