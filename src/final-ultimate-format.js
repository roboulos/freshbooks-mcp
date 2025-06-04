const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, 'index.ts');
let content = fs.readFileSync(filePath, 'utf8');

console.log('🎯 Final pass for ULTIMATE format...');

const separator = '='.repeat(50);

// More tools that need updating
const finalUpdates = [
  // Auth me
  {
    search: 'text: JSON.stringify({ user: result }, null, 2)',
    replace: `text: \`🔐 Authentication - User: "\${result.name || 'Unknown'}" | ID: \${result.id || 'N/A'} | Email: \${result.email || 'N/A'}\\n${separator}\\n\\n\` + JSON.stringify({ user: result }, null, 2)`
  },
  
  // List functions
  {
    search: 'text: JSON.stringify(result, null, 2)',
    context: 'xano_list_functions',
    searchBefore: 'data: result,\n                operation: "xano_list_functions"',
    replace: `text: (() => {
              const page = result.curPage || 1;
              const items = result.items || [];
              const total = result.total || items.length;
              const perPage = result.perPage || 50;
              const totalPages = Math.ceil(total / perPage);
              return \`⚡ Functions - \${items.length} function(s) | Page \${page}/\${totalPages}\\n${separator}\\n\\n\` + JSON.stringify(result, null, 2);
            })()`
  },
  
  // Get function details  
  {
    search: 'text: JSON.stringify(result, null, 2)',
    context: 'xano_get_function_details',
    searchBefore: 'data: result,\n                operation: "xano_get_function_details"',
    replace: `text: \`⚡ Function Details - "\${result.name || 'Unknown'}" | ID: \${result.id || function_id} | Draft: \${include_draft ? 'Yes' : 'No'}\\n${separator}\\n\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // List tasks
  {
    search: 'text: JSON.stringify(result, null, 2)',
    context: 'xano_list_tasks',
    searchBefore: 'data: result,\n                operation: "xano_list_tasks"',
    replace: `text: (() => {
              const page = result.curPage || 1;
              const items = result.items || [];
              const total = result.total || items.length;
              const perPage = result.perPage || 50;
              const totalPages = Math.ceil(total / perPage);
              return \`⏰ Tasks - \${items.length} task(s) | Page \${page}/\${totalPages}\\n${separator}\\n\\n\` + JSON.stringify(result, null, 2);
            })()`
  },
  
  // Get task details
  {
    search: 'text: JSON.stringify(result, null, 2)',
    context: 'xano_get_task_details',
    searchBefore: 'data: result,\n                operation: "xano_get_task_details"',
    replace: `text: \`⏰ Task Details - "\${result.name || 'Unknown'}" | ID: \${result.id || task_id} | Active: \${result.active || false} | Draft: \${include_draft ? 'Yes' : 'No'}\\n${separator}\\n\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // Get API with logic
  {
    search: 'text: JSON.stringify(result, null, 2)',
    context: 'xano_get_api_with_logic',
    searchBefore: 'data: result,\n                operation: "xano_get_api_with_logic"',
    replace: `text: \`📝 API Logic - "\${result.name || 'Unknown'}" | \${result.verb || 'GET'} | \${result.input?.length || 0} inputs | Draft: \${include_draft ? 'Yes' : 'No'}\\n${separator}\\n\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // List APIs with logic
  {
    search: 'text: JSON.stringify(result, null, 2)',
    context: 'xano_list_apis_with_logic',
    searchBefore: 'data: result,\n                operation: "xano_list_apis_with_logic"',
    replace: `text: \`📋 APIs with Logic - \${result.items?.length || 0} API(s) | Group: \${api_group_id}\\n${separator}\\n\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // Get table with script
  {
    search: 'text: JSON.stringify(result, null, 2)',
    context: 'xano_get_table_with_script',
    searchBefore: 'data: result,\n                operation: "xano_get_table_with_script"',
    replace: `text: \`📜 Table Script - "\${result.name || 'Unknown'}" | ID: \${result.id || table_id} | \${result.script?.length || 0} characters\\n${separator}\\n\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // Create search index
  {
    search: 'text: JSON.stringify({\n                success: true,\n                data: result,\n                operation: "xano_create_search_index"\n              }, null, 2)',
    replace: `text: \`🔍 Search Index Created - "\${name}" | \${fields?.length || 0} field(s) | Table: \${table_id}\\n${separator}\\n\\n\` + JSON.stringify({
                success: true,
                data: result,
                operation: "xano_create_search_index"
              }, null, 2)`
  },
  
  // Create btree index
  {
    search: 'text: JSON.stringify({\n                success: true,\n                data: result,\n                operation: "xano_create_btree_index"\n              }, null, 2)',
    replace: `text: \`🗂️ BTree Index Created - ID: \${result.id || 'N/A'} | \${fields?.length || 0} field(s) | Table: \${table_id}\\n${separator}\\n\\n\` + JSON.stringify({
                success: true,
                data: result,
                operation: "xano_create_btree_index"
              }, null, 2)`
  },
  
  // Truncate table
  {
    search: 'text: JSON.stringify({\n                success: true,\n                message: `Table ${table_id} truncated successfully`,\n                operation: "xano_truncate_table"\n              }, null, 2)',
    replace: `text: \`🧹 Table Truncated - ID: \${table_id} | Primary key reset: \${reset || false}\\n${separator}\\n\\n\` + JSON.stringify({
                success: true,
                message: \`Table \${table_id} truncated successfully\`,
                operation: "xano_truncate_table"
              }, null, 2)`
  },
  
  // Create operations with success messages
  {
    search: 'message: "API group created successfully"',
    context: 'xano_create_api_group',
    fullReplace: {
      from: 'text: JSON.stringify({\n                success: true,\n                message: "API group created successfully",\n                data: result,\n                operation: "xano_create_api_group"\n              }, null, 2)',
      to: `text: \`✨ API Group Created - ID: \${result.id || 'N/A'} | Name: "\${result.name || name}"\\n${separator}\\n\\n\` + JSON.stringify({
                success: true,
                message: "API group created successfully",
                data: result,
                operation: "xano_create_api_group"
              }, null, 2)`
    }
  },
  
  {
    search: 'message: "API created successfully"',
    context: 'xano_create_api',
    fullReplace: {
      from: 'text: JSON.stringify({\n                success: true,\n                message: "API created successfully",\n                data: result,\n                operation: "xano_create_api"\n              }, null, 2)',
      to: `text: \`🚀 API Created - ID: \${result.id || 'N/A'} | \${result.verb || verb} \${result.path || path || '/'} | Auth: \${result.auth || false}\\n${separator}\\n\\n\` + JSON.stringify({
                success: true,
                message: "API created successfully",
                data: result,
                operation: "xano_create_api"
              }, null, 2)`
    }
  },
  
  {
    search: 'message: "File uploaded successfully"',
    context: 'xano_upload_file',
    fullReplace: {
      from: 'text: JSON.stringify({\n                success: true,\n                message: "File uploaded successfully",\n                data: result\n              }, null, 2)',
      to: `text: \`📤 File Uploaded - "\${result.name || file_name}" | Size: \${result.size || 0} bytes | ID: \${result.id || 'N/A'}\\n${separator}\\n\\n\` + JSON.stringify({
                success: true,
                message: "File uploaded successfully",
                data: result
              }, null, 2)`
    }
  }
];

// Apply final updates
let changeCount = 0;
finalUpdates.forEach(({ search, replace, context, fullReplace }) => {
  if (fullReplace) {
    if (content.includes(fullReplace.from)) {
      content = content.replace(fullReplace.from, fullReplace.to);
      changeCount++;
      console.log(`✅ Updated: ${context}`);
    }
  } else if (content.includes(search)) {
    content = content.replace(search, replace);
    changeCount++;
    console.log(`✅ Updated: ${context || search.substring(0, 50)}...`);
  }
});

// Fix field operations
const fieldOps = [
  {
    search: 'data: result || { message: "Field added successfully" },\n                operation: "xano_add_field_to_schema"',
    replace: 'data: result || { message: "Field added successfully" },\n                operation: "xano_add_field_to_schema"',
    headerReplace: {
      from: 'text: JSON.stringify({\n                success: true,\n                data: result || { message: "Field added successfully" },\n                operation: "xano_add_field_to_schema"\n              }, null, 2)',
      to: `text: \`➕ Field Added - "\${field_name}" (\${field_type}) to Table \${table_id}\\n${separator}\\n\\n\` + JSON.stringify({
                success: true,
                data: result || { message: "Field added successfully" },
                operation: "xano_add_field_to_schema"
              }, null, 2)`
    }
  },
  {
    search: 'data: result || { message: "Field renamed successfully" },\n                operation: "xano_rename_schema_field"',
    headerReplace: {
      from: 'text: JSON.stringify({\n                success: true,\n                data: result || { message: "Field renamed successfully" },\n                operation: "xano_rename_schema_field"\n              }, null, 2)',
      to: `text: \`✏️ Field Renamed - "\${old_name}" → "\${new_name}" | Table: \${table_id}\\n${separator}\\n\\n\` + JSON.stringify({
                success: true,
                data: result || { message: "Field renamed successfully" },
                operation: "xano_rename_schema_field"
              }, null, 2)`
    }
  },
  {
    search: 'message: "Field deleted successfully",\n                operation: "xano_delete_field"',
    headerReplace: {
      from: 'text: JSON.stringify({\n                success: true,\n                message: "Field deleted successfully",\n                operation: "xano_delete_field"\n              }, null, 2)',
      to: `text: \`🗑️ Field Deleted - "\${field_name}" from Table \${table_id}\\n${separator}\\n\\n\` + JSON.stringify({
                success: true,
                message: "Field deleted successfully",
                operation: "xano_delete_field"
              }, null, 2)`
    }
  }
];

fieldOps.forEach(({ headerReplace }) => {
  if (headerReplace && content.includes(headerReplace.from)) {
    content = content.replace(headerReplace.from, headerReplace.to);
    changeCount++;
    console.log(`✅ Updated field operation`);
  }
});

// Debug operations
const debugOps = [
  {
    search: 'keyCount: keys.length,',
    context: 'debug_kv_storage',
    fullText: 'text: JSON.stringify({\n                keyCount: keys.length,\n                keys: keys,\n                oauth_tokens: oauth_tokens,\n                xano_auth_tokens: xano_auth_tokens\n              }, null, 2)',
    replace: `text: \`🔑 KV Storage Debug - \${keys.length} key(s) found\\n${separator}\\n\\n\` + JSON.stringify({
                keyCount: keys.length,
                keys: keys,
                oauth_tokens: oauth_tokens,
                xano_auth_tokens: xano_auth_tokens
              }, null, 2)`
  },
  {
    search: 'success: !!sessionInfo,\n                sessionInfo: sessionInfo',
    context: 'debug_session_info',
    fullText: 'text: JSON.stringify({\n                success: !!sessionInfo,\n                sessionInfo: sessionInfo\n              }, null, 2)',
    replace: `text: \`📊 Session Info - Active: \${!!sessionInfo ? 'Yes' : 'No'}\\n${separator}\\n\\n\` + JSON.stringify({
                success: !!sessionInfo,
                sessionInfo: sessionInfo
              }, null, 2)`
  },
  {
    search: 'sessionCount: result.sessions?.length || 0,',
    context: 'debug_list_active_sessions',
    fullText: 'text: JSON.stringify({\n                success: result.success,\n                sessionCount: result.sessions?.length || 0,\n                sessions: result.sessions\n              }, null, 2)',
    replace: `text: \`📋 Active Sessions - \${result.sessions?.length || 0} session(s) found\\n${separator}\\n\\n\` + JSON.stringify({
                success: result.success,
                sessionCount: result.sessions?.length || 0,
                sessions: result.sessions
              }, null, 2)`
  }
];

debugOps.forEach(({ fullText, replace, context }) => {
  if (content.includes(fullText)) {
    content = content.replace(fullText, replace);
    changeCount++;
    console.log(`✅ Updated: ${context}`);
  }
});

// Write back
fs.writeFileSync(filePath, content);
console.log(`\n✅ Final ultimate format applied! Total changes: ${changeCount}`);