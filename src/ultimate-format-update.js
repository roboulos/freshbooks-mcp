const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, 'index.ts');
let content = fs.readFileSync(filePath, 'utf8');

console.log('🚀 Applying ULTIMATE format update to all 69 tools...');

// Helper function to create the separator line
const separator = '='.repeat(50);

// Define all tool format updates
const toolFormats = [
  // Instance operations
  {
    tool: 'xano_list_instances',
    format: (data) => `🏢 Xano Instances - ${data.instances?.length || 0} instance(s) found\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  
  // API Group operations
  {
    tool: 'xano_browse_api_groups',
    format: (data) => {
      const page = data.page || 1;
      const perPage = data.per_page || 50;
      const totalPages = Math.ceil((data.api_groups?.length || 0) / perPage);
      return `🎯 API Groups - ${data.api_groups?.length || 0} group(s) | Page ${page}/${totalPages}\n${separator}\n\n${JSON.stringify(data, null, 2)}`;
    }
  },
  {
    tool: 'xano_get_api_group',
    format: (data) => `📁 API Group - "${data.api_group?.name || 'Unknown'}" | ${data.api_group?.tag?.length || 0} tags | Swagger: ${data.api_group?.swagger || false}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_create_api_group',
    format: (data) => `✨ API Group Created - ID: ${data.data?.id || 'N/A'} | Name: "${data.data?.name || 'Unknown'}"\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_update_api_group',
    format: (data, params) => `✏️ API Group Updated - ID: ${params.api_group_id} | Updated at: ${data.data?.updated_at || new Date().toISOString()}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  
  // API operations
  {
    tool: 'xano_browse_apis_in_group',
    format: (data) => {
      const page = data.page || 1;
      const perPage = data.per_page || 50;
      const totalPages = Math.ceil((data.apis?.length || 0) / perPage);
      return `🔌 APIs in Group - ${data.apis?.length || 0} API(s) | Page ${page}/${totalPages}\n${separator}\n\n${JSON.stringify(data, null, 2)}`;
    }
  },
  {
    tool: 'xano_create_api',
    format: (data) => `🚀 API Created - ID: ${data.data?.id || 'N/A'} | ${data.data?.verb || 'GET'} ${data.data?.path || '/'} | Auth: ${data.data?.auth || false}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_get_api',
    format: (data) => `🔌 API Details - "${data.api?.name || 'Unknown'}" | ${data.api?.verb || 'GET'} ${data.api?.path || '/'} | ${data.api?.input?.length || 0} inputs\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_update_api',
    format: (data, params) => `✏️ API Updated - ID: ${params.api_id} | Updated at: ${data.data?.updated_at || new Date().toISOString()}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_delete_api',
    format: (data, params) => `🗑️ API Deleted - ID: ${params.api_id} from Group ${params.api_group_id}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  
  // File operations
  {
    tool: 'xano_list_files',
    format: (data) => {
      const page = data.page || 1;
      const perPage = data.per_page || 50;
      const totalPages = Math.ceil((data.files?.length || 0) / perPage);
      return `📁 Files - ${data.files?.length || 0} file(s) | Page ${page}/${totalPages}\n${separator}\n\n${JSON.stringify(data, null, 2)}`;
    }
  },
  {
    tool: 'xano_upload_file',
    format: (data) => `📤 File Uploaded - "${data.data?.name || 'Unknown'}" | Size: ${data.data?.size || 0} bytes | ID: ${data.data?.id || 'N/A'}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_delete_file',
    format: (data, params) => `🗑️ File Deleted - ID: ${params.file_id} | Workspace: ${params.workspace_id}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  
  // Branch operations
  {
    tool: 'xano_list_workspace_branches',
    format: (data) => {
      const liveBranch = data.branches?.find(b => b.live)?.name || 'main';
      return `🌿 Workspace Branches - ${data.branches?.length || 0} branch(es) | Live: ${liveBranch}\n${separator}\n\n${JSON.stringify(data, null, 2)}`;
    }
  },
  {
    tool: 'xano_delete_workspace_branch',
    format: (data, params) => `🗑️ Branch Deleted - "${params.branch_name}" from Workspace ${params.workspace_id}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  
  // Request history
  {
    tool: 'xano_browse_request_history',
    format: (data) => {
      const page = data.page || 1;
      const perPage = data.per_page || 50;
      const totalPages = Math.ceil((data.requests?.length || 0) / perPage);
      return `📊 Request History - ${data.requests?.length || 0} request(s) | Page ${page}/${totalPages}\n${separator}\n\n${JSON.stringify(data, null, 2)}`;
    }
  },
  
  // Database operations
  {
    tool: 'xano_list_databases',
    format: (data) => `💾 Xano Databases - ${data.databases?.length || 0} workspace(s) found\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_get_instance_details',
    format: (data) => `🏗️ Instance Details - "${data.instance?.display || 'Unknown'}" | Rate limit: ${data.instance?.rate_limit || 'N/A'}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_get_workspace_details',
    format: (data) => `🗂️ Workspace Details - "${data.workspace?.name || 'Unknown'}" | ID: ${data.workspace?.id || 'N/A'} | Branch: ${data.workspace?.branch || 'main'}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  
  // Table operations
  {
    tool: 'xano_list_tables',
    format: (data) => {
      const page = data.page || 1;
      const perPage = data.per_page || 50;
      const totalPages = Math.ceil((data.tables?.length || 0) / perPage);
      return `📋 Tables - ${data.tables?.length || 0} table(s) | Page ${page}/${totalPages}\n${separator}\n\n${JSON.stringify(data, null, 2)}`;
    }
  },
  {
    tool: 'xano_get_table_details',
    format: (data) => `📋 Table Details - "${data.data?.name || 'Unknown'}" | ID: ${data.data?.id || 'N/A'} | Auth: ${data.data?.auth || false}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_get_table_schema',
    format: (data, params) => `🔧 Table Schema - ${data.data?.schema?.length || 0} fields | Table: ${params.table_id}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_create_table',
    format: (data, params) => `📊 Table Created - ID: ${data.data?.id || 'N/A'} | Workspace: ${params.workspace_id}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_update_table',
    format: (data, params) => `✏️ Table Updated - ID: ${params.table_id} | Fields modified\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_delete_table',
    format: (data, params) => `🗑️ Table Deleted - ID: ${params.table_id} | Workspace: ${params.workspace_id}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  
  // Field operations
  {
    tool: 'xano_add_field_to_schema',
    format: (data, params) => `➕ Field Added - "${params.field_name}" (${params.field_type}) to Table ${params.table_id}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_rename_schema_field',
    format: (data, params) => `✏️ Field Renamed - "${params.old_name}" → "${params.new_name}" | Table: ${params.table_id}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_delete_field',
    format: (data, params) => `🗑️ Field Deleted - "${params.field_name}" from Table ${params.table_id}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  
  // Record operations
  {
    tool: 'xano_browse_table_content',
    format: (data, params) => {
      const page = params.page || 1;
      const perPage = params.per_page || 50;
      const totalPages = Math.ceil((data.data?.total || 0) / perPage);
      return `📋 Table Content - ${data.data?.items?.length || 0} record(s) | Page ${page}/${totalPages}\n${separator}\n\n${JSON.stringify(data, null, 2)}`;
    }
  },
  {
    tool: 'xano_get_table_record',
    format: (data, params) => `📄 Record Details - ID: ${data.record?.id || params.record_id} | Table: ${params.table_id}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_create_table_record',
    format: (data) => {
      const keyInfo = data.data?.name || data.data?.email || data.data?.title || '';
      return `➕ Record Created - ID: ${data.data?.id || 'N/A'}${keyInfo ? ` | ${keyInfo}` : ''}\n${separator}\n\n${JSON.stringify(data, null, 2)}`;
    }
  },
  {
    tool: 'xano_update_table_record',
    format: (data, params) => {
      const fieldsChanged = Object.keys(params.record_data || {}).length;
      return `✏️ Record Updated - ID: ${params.record_id} | ${fieldsChanged} field(s) modified\n${separator}\n\n${JSON.stringify(data, null, 2)}`;
    }
  },
  {
    tool: 'xano_delete_table_record',
    format: (data, params) => `🗑️ Record Deleted - ID: ${params.record_id} from Table ${params.table_id}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_bulk_create_records',
    format: (data) => {
      const ids = data.data?.map(r => r.id).join(', ') || 'N/A';
      return `➕ Bulk Create - ${data.data?.length || 0} record(s) created | IDs: [${ids}]\n${separator}\n\n${JSON.stringify(data, null, 2)}`;
    }
  },
  {
    tool: 'xano_bulk_update_records',
    format: (data) => {
      const count = data.data?.update_count || data.data?.updated_records?.length || 0;
      const ids = data.data?.updated_records?.join(', ') || 'N/A';
      return `✏️ Bulk Update - ${count} record(s) modified | IDs: [${ids}]\n${separator}\n\n${JSON.stringify(data, null, 2)}`;
    }
  },
  
  // Auth operations
  {
    tool: 'xano_auth_me',
    format: (data) => `🔐 Authentication - User: "${data.user?.name || 'Unknown'}" | ID: ${data.user?.id || 'N/A'} | Email: ${data.user?.email || 'N/A'}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  
  // Function operations
  {
    tool: 'xano_list_functions',
    format: (data) => {
      const page = data.page || 1;
      const perPage = data.per_page || 50;
      const totalPages = Math.ceil((data.data?.total || 0) / perPage);
      return `⚡ Functions - ${data.data?.items?.length || 0} function(s) | Page ${page}/${totalPages}\n${separator}\n\n${JSON.stringify(data, null, 2)}`;
    }
  },
  {
    tool: 'xano_create_function',
    format: (data) => `✨ Function Created - "${data.data?.name || 'Unknown'}" | ID: ${data.data?.id || 'N/A'} | Draft: ${data.data?._draft_last_update ? 'Yes' : 'No'}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_get_function_details',
    format: (data) => `⚡ Function Details - "${data.data?.name || 'Unknown'}" | ID: ${data.data?.id || 'N/A'} | Draft: ${data.include_draft ? 'Yes' : 'No'}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_delete_function',
    format: (data, params) => `🗑️ Function Deleted - ID: ${params.function_id} | Workspace: ${params.workspace_id}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_update_function',
    format: (data, params) => `✏️ Function Updated - ID: ${params.function_id} | Draft created\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_publish_function',
    format: (data, params) => `🚀 Function Published - ID: ${params.function_id} | Now live\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  
  // Index operations
  {
    tool: 'xano_create_search_index',
    format: (data, params) => `🔍 Search Index Created - "${params.name}" | ${params.fields?.length || 0} field(s) | Table: ${params.table_id}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_create_btree_index',
    format: (data, params) => `🗂️ BTree Index Created - ID: ${data.data?.id || 'N/A'} | ${params.fields?.length || 0} field(s) | Table: ${params.table_id}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  
  // API with logic operations
  {
    tool: 'xano_create_api_with_logic',
    format: (data) => `🚀 API Created - "${data.data?.name || 'Unknown'}" | ${data.data?.verb || 'GET'} | ID: ${data.data?.id || 'N/A'} | ${data.data?.input?.length || 0} inputs\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_get_api_with_logic',
    format: (data) => `📝 API Logic - "${data.data?.name || 'Unknown'}" | ${data.data?.verb || 'GET'} | ${data.data?.input?.length || 0} inputs | Draft: ${data.include_draft ? 'Yes' : 'No'}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_update_api_with_logic',
    format: (data, params) => `✏️ API Logic Updated - ID: ${params.api_id} | Draft saved\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_list_apis_with_logic',
    format: (data, params) => `📋 APIs with Logic - ${data.data?.items?.length || 0} API(s) | Group: ${params.api_group_id}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_publish_api',
    format: (data, params) => `🚀 API Published - ID: ${params.api_id} | Group: ${params.api_group_id} | Now live\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  
  // Task operations
  {
    tool: 'xano_create_task',
    format: (data) => `➕ Task Created - "${data.data?.name || 'Unknown'}" | ID: ${data.data?.id || 'N/A'} | Active: ${data.data?.active || false}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_list_tasks',
    format: (data) => {
      const page = data.page || 1;
      const perPage = data.per_page || 50;
      const totalPages = Math.ceil((data.data?.total || 0) / perPage);
      return `⏰ Tasks - ${data.data?.items?.length || 0} task(s) | Page ${page}/${totalPages}\n${separator}\n\n${JSON.stringify(data, null, 2)}`;
    }
  },
  {
    tool: 'xano_get_task_details',
    format: (data) => `⏰ Task Details - "${data.data?.name || 'Unknown'}" | ID: ${data.data?.id || 'N/A'} | Active: ${data.data?.active || false} | Draft: ${data.include_draft ? 'Yes' : 'No'}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_update_task',
    format: (data, params) => `✏️ Task Updated - ID: ${params.task_id} | Draft created\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_delete_task',
    format: (data, params) => `🗑️ Task Deleted - ID: ${params.task_id} | Workspace: ${params.workspace_id}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_publish_task',
    format: (data, params) => `🚀 Task Published - ID: ${params.task_id} | Now active: ${data.data?.active || false}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_activate_task',
    format: (data, params) => `🔄 Task Status - ID: ${params.task_id} | Active: ${params.active} | Draft created\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  
  // Table with script operations
  {
    tool: 'xano_create_table_with_script',
    format: (data) => {
      const nameMatch = data.script?.match(/table\\s+(\\w+)/);
      const name = nameMatch?.[1] || 'Unknown';
      const fieldCount = (data.script?.match(/field\\s+\\w+/g) || []).length;
      return `🏗️ Table Created - "${name}" | ${fieldCount} fields defined\n${separator}\n\n${JSON.stringify(data, null, 2)}`;
    }
  },
  {
    tool: 'xano_get_table_with_script',
    format: (data) => `📜 Table Script - "${data.data?.name || 'Unknown'}" | ID: ${data.data?.id || 'N/A'} | ${data.data?.script?.length || 0} characters\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_update_table_with_script',
    format: (data, params) => `✏️ Table Schema Updated - ID: ${params.table_id} | Script applied\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  
  // Export operations
  {
    tool: 'xano_export_workspace',
    format: (data, params) => `📤 Workspace Exported - ID: ${params.workspace_id} | Data included: ${params.include_data || false}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'xano_export_workspace_schema',
    format: (data, params) => `📤 Schema Exported - Workspace: ${params.workspace_id} | Branch: ${params.branch || 'live'}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  
  // Other operations
  {
    tool: 'xano_truncate_table',
    format: (data, params) => `🧹 Table Truncated - ID: ${params.table_id} | Primary key reset: ${params.reset || false}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  
  // Debug operations
  {
    tool: 'whoami',
    format: (data) => `👤 Current User - ID: ${data.userId || 'N/A'} | Authenticated: ${!!data.userId}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'hello',
    format: (data, params) => `👋 Hello - ${params.name} | User ID: ${data.userId || 'N/A'}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'debug_expire_oauth_tokens',
    format: (data) => {
      const total = (data.deleted?.oauth_tokens || 0) + (data.deleted?.xano_auth_tokens || 0);
      return `🗑️ Tokens Expired - ${total} token(s) deleted\n${separator}\n\n${JSON.stringify(data, null, 2)}`;
    }
  },
  {
    tool: 'debug_list_active_sessions',
    format: (data) => `📋 Active Sessions - ${data.sessionCount || 0} session(s) found\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  }
];

// Process each tool format
toolFormats.forEach(({ tool, format }) => {
  console.log(`🔧 Updating ${tool}...`);
  
  // Create a regex pattern to find the tool's return statement
  const toolPattern = new RegExp(
    `(async ${tool}\\([^)]*\\)[\\s\\S]*?return\\s*{[\\s\\S]*?content:\\s*\\[{[\\s\\S]*?text:\\s*)([\\s\\S]*?)(?=\\s*}\\s*]\\s*})`,
    'g'
  );
  
  content = content.replace(toolPattern, (match, prefix, currentText) => {
    // Extract the part that builds the response
    const responseMatch = currentText.match(/JSON\.stringify\(([\s\S]+?)\)(?:\s*,\s*null,\s*2)?/);
    
    if (responseMatch) {
      // Build the new format function call
      let newText = currentText;
      
      // Check if this tool needs params
      const needsParams = format.toString().includes('params');
      
      if (needsParams) {
        // Find the params in the function signature
        const funcMatch = match.match(/async\s+\w+\(([^)]+)\)/);
        const paramName = funcMatch?.[1]?.trim() || 'params';
        
        newText = `((data: any) => {
              const formatFn = ${format.toString()};
              return formatFn(data, ${paramName});
            })(${responseMatch[1]})`;
      } else {
        newText = `((data: any) => {
              const formatFn = ${format.toString()};
              return formatFn(data);
            })(${responseMatch[1]})`;
      }
      
      return prefix + newText;
    }
    
    return match;
  });
});

// Handle error responses with the new format
console.log('🔧 Updating error response format...');

content = content.replace(
  /isError:\s*true,\s*content:\s*\[{\s*type:\s*"text",\s*text:\s*([^}]+)\s*}\]/g,
  (match, errorText) => {
    // Extract tool name from context if possible
    const toolMatch = match.match(/operation:\s*"(\w+)"/);
    const toolName = toolMatch?.[1] || 'Operation';
    
    return `isError: true,
            content: [{
              type: "text",
              text: \`❌ \${error.message?.includes('Missing required') ? '${toolName} Failed' : '${toolName} Error'} - \${error.message || 'Unknown error'}\\n${'='.repeat(50)}\\n\\n\${JSON.stringify({ error: error.message, details: error.response?.data }, null, 2)}\`
            }]`;
  }
);

// Write the updated file
fs.writeFileSync(filePath, content);
console.log('✅ ULTIMATE format update complete!');
console.log('📋 Summary:');
console.log(`  - ${toolFormats.length} tools updated with new format`);
console.log('  - Header shows emoji, action, and key metrics');
console.log('  - Separator line between header and data');
console.log('  - Error responses standardized');
console.log('  - All responses now instantly scannable!');