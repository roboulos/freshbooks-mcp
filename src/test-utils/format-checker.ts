export const ultimateFormatChecker = {
  formatResponse(toolName: string, data: any): string {
    const separator = '='.repeat(50);
    
    switch (toolName) {
      // List operations
      case 'xano_list_instances':
        return `🏢 Xano Instances - ${data.length} instance(s) found\n${separator}\n${JSON.stringify({ instances: data }, null, 2)}`;
      
      case 'xano_browse_api_groups':
        return `🎯 API Groups - ${data.items.length} group(s) | Page ${data.curPage}/${data.totPage}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_list_databases':
        return `💾 Xano Databases - ${data.databases.length} workspace(s) found\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_list_tables':
        return `📋 Tables - ${data.tables.items.length} table(s) | Page ${data.tables.curPage}/${data.tables.totPage}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_list_files':
        return `📁 Files - ${data.items.length} file(s) | Page ${data.curPage}/${data.totPage}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_list_functions':
        return `⚡ Functions - ${data.data.items.length} function(s) | Page ${data.data.curPage}/${data.data.totPage}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_list_tasks':
        return `⏰ Tasks - ${data.data.items.length} task(s) | Page ${data.data.curPage}/${data.data.totPage}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_list_workspace_branches':
        const liveBranch = data.find((b: any) => b.is_live)?.name || 'none';
        return `🌿 Workspace Branches - ${data.length} branch(es) | Live: ${liveBranch}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_browse_request_history':
        return `📊 Request History - ${data.items.length} request(s) | Page ${data.curPage}/${data.totPage}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_list_apis_with_logic':
        return `📋 APIs with Logic - ${data.data.items.length} API(s) | Group: ${data.api_group_id || 'N/A'}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      // Get/Details operations
      case 'xano_get_instance_details':
        return `🏗️ Instance Details - "${data.display}" | Rate limit: ${data.rate_limit}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_get_workspace_details':
        return `🗂️ Workspace Details - "${data.name}" | ID: ${data.id} | Branch: ${data.branch}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_get_table_details':
        return `📋 Table Details - "${data.name}" | ID: ${data.id} | Auth: ${data.auth}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_get_table_schema':
        return `🔧 Table Schema - ${data.data.schema.length} fields | Table: ${data.data.table_id}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_get_api_group':
        return `📁 API Group - "${data.name}" | ${data.tag.length} tags | Swagger: ${data.swagger}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_get_api':
        return `🔌 API Details - "${data.name}" | ${data.verb} ${data.path} | ${data.input.length} inputs\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_get_function_details':
        const isDraft = data._draft_last_update ? 'Yes' : 'No';
        return `⚡ Function Details - "${data.name}" | ID: ${data.id} | Draft: ${isDraft}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_get_task_details':
        const taskDraft = data._draft_last_update ? 'Yes' : 'No';
        const activeStatus = data.active === null || data.active === undefined ? 'N/A' : String(data.active);
        return `⏰ Task Details - "${data.name}" | ID: ${data.id} | Active: ${activeStatus} | Draft: ${taskDraft}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_get_table_record':
        const keyField = data.email || data.name || `ID: ${data.id}`;
        return `📄 Record Details - ID: ${data.id} | ${keyField}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_get_api_with_logic':
        const apiDraft = data._draft_last_update ? 'Yes' : 'No';
        return `📝 API Logic - "${data.name}" | ${data.verb} | ${data.input.length} inputs | Draft: ${apiDraft}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      // Create operations
      case 'xano_create_table':
        return `📊 Table Created - ID: ${data.id} | Workspace: ${data.workspace_id}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_create_api_group':
        return `✨ API Group Created - ID: ${data.id} | Name: "${data.name}"\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_create_api':
        return `🚀 API Created - ID: ${data.id} | ${data.verb} ${data.path || ''} | Auth: ${data.auth}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_create_table_record':
        const recordKey = data.data.email || data.data.name || '';
        return `➕ Record Created - ID: ${data.data.id} | ${recordKey}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_create_function':
        const funcDraft = data.data._draft_last_update ? 'Yes' : 'No';
        return `✨ Function Created - "${data.data.name}" | ID: ${data.data.id} | Draft: ${funcDraft}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_create_task':
        return `➕ Task Created - "${data.data.name}" | ID: ${data.data.id} | Active: ${data.data.active}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_create_api_with_logic':
        return `🚀 API Created - "${data.data.name}" | ${data.data.verb} | ID: ${data.data.id} | ${data.data.input.length} inputs\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_create_btree_index':
        return `🗂️ BTree Index Created - ID: ${data.data.id} | ${data.data.fields.length} field(s) | Table: ${data.table_id || 'N/A'}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_create_search_index':
        return `🔍 Search Index Created - "${data.name}" | ${data.fields.length} field(s) | Table: ${data.table_id}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_create_table_with_script':
        return `🏗️ Table Created - "${data.name}" | ${data.field_count} fields defined\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      // Update operations
      case 'xano_update_table':
        return `✏️ Table Updated - ID: ${data.table_id} | Fields modified\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_update_api_group':
        return `✏️ API Group Updated - ID: ${data.api_group_id} | Updated at: ${data.updated_at}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_update_api':
        return `✏️ API Updated - ID: ${data.api_id} | Updated at: ${data.updated_at}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_update_table_record':
        return `✏️ Record Updated - ID: ${data.id} | ${data.fields_changed.length} field(s) modified\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_update_function':
        return `✏️ Function Updated - ID: ${data.function_id} | Draft created\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_update_task':
        return `✏️ Task Updated - ID: ${data.task_id} | Draft created\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_update_api_with_logic':
        return `✏️ API Logic Updated - ID: ${data.api_id} | Draft saved\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_update_table_with_script':
        return `✏️ Table Schema Updated - ID: ${data.table_id} | Script applied\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      // Delete operations
      case 'xano_delete_table':
        return `🗑️ Table Deleted - ID: ${data.table_id} | Workspace: ${data.workspace_id}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_delete_api_group':
        return `🗑️ API Group Deleted - ID: ${data.api_group_id} | Workspace: ${data.workspace_id}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_delete_api':
        return `🗑️ API Deleted - ID: ${data.api_id} from Group ${data.api_group_id}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_delete_table_record':
        return `🗑️ Record Deleted - ID: ${data.record_id} from Table ${data.table_id}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_delete_function':
        return `🗑️ Function Deleted - ID: ${data.function_id} | Workspace: ${data.workspace_id}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_delete_task':
        return `🗑️ Task Deleted - ID: ${data.task_id} | Workspace: ${data.workspace_id}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_delete_file':
        return `🗑️ File Deleted - ID: ${data.file_id} | Workspace: ${data.workspace_id}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_delete_field':
        return `🗑️ Field Deleted - "${data.field_name}" from Table ${data.table_id}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_delete_workspace_branch':
        return `🗑️ Branch Deleted - "${data.branch_name}" from Workspace ${data.workspace_id}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      // Bulk operations
      case 'xano_bulk_create_records':
        return `➕ Bulk Create - ${data.data.length} record(s) created | IDs: [${data.data.join(', ')}]\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_bulk_update_records':
        return `✏️ Bulk Update - ${data.data.update_count} record(s) modified | IDs: [${data.data.updated_records.join(', ')}]\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      // Special operations
      case 'xano_add_field_to_schema':
        return `➕ Field Added - "${data.field_name}" (${data.field_type}) to Table ${data.table_id}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_rename_schema_field':
        return `✏️ Field Renamed - "${data.old_name}" → "${data.new_name}" | Table: ${data.table_id}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_browse_table_content':
        return `📋 Table Content - ${data.data.items.length} record(s) | Page ${data.data.curPage}/${data.data.totPage}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_upload_file':
        return `📤 File Uploaded - "${data.name}" | Size: ${data.size} bytes | ID: ${data.id}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_truncate_table':
        return `🧹 Table Truncated - ID: ${data.table_id} | Primary key reset: ${data.reset}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_export_workspace':
        return `📤 Workspace Exported - ID: ${data.workspace_id} | Data included: ${data.include_data}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_export_workspace_schema':
        return `📤 Schema Exported - Workspace: ${data.workspace_id} | Branch: ${data.branch || 'live'}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_publish_function':
        return `🚀 Function Published - ID: ${data.function_id} | Now live\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_publish_api':
        return `🚀 API Published - ID: ${data.api_id} | Group: ${data.api_group_id} | Now live\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_publish_task':
        return `🚀 Task Published - ID: ${data.task_id} | Now active: ${data.active || true}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_activate_task':
        return `🔄 Task Status - ID: ${data.task_id} | Active: ${data.active} | Draft created\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_get_table_with_script':
        return `📜 Table Script - "${data.name}" | ID: ${data.id} | ${data.script.length} characters\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_auth_me':
        return `🔐 Authentication - User: "${data.name}" | ID: ${data.id} | Email: ${data.email}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_get_function_template':
        return `🧱 Function Template - "${data.function_name}" | Type: XanoScript\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_get_block_template':
        return `📋 Block Template - "${data.block_name}" | Type: XanoScript\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_get_started':
        return `🚀 XanoScript Setup Guide - Quick reference loaded\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'xano_validate_line':
        return `🔧 Line Validation - ${data.valid ? 'Valid' : 'Invalid'} | Context: ${data.context}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'whoami':
        return `👤 Current User - ID: ${data.userId} | Authenticated: ${data.authenticated}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'hello':
        return `👋 Hello - ${data.greeting} | User ID: ${data.userId}\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'debug_expire_oauth_tokens':
        return `🗑️ Tokens Expired - ${data.deleted.oauth_tokens + data.deleted.xano_auth_tokens} token(s) deleted\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      case 'debug_list_active_sessions':
        return `📋 Active Sessions - ${data.sessionCount} session(s) found\n${separator}\n${JSON.stringify(data, null, 2)}`;
      
      default:
        return `📌 ${toolName} - Response\n${separator}\n${JSON.stringify(data, null, 2)}`;
    }
  },

  formatError(toolName: string, error: string): string {
    const separator = '='.repeat(50);
    const toolDisplayName = toolName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return `❌ ${toolDisplayName} Failed - ${error}\n${separator}\n${error}`;
  }
};