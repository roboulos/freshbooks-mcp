const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, 'index.ts');
let content = fs.readFileSync(filePath, 'utf8');

console.log('🚀 Implementing Ultimate Format based on test specifications...');

const separator = '='.repeat(50);

// Define all the format transformations based on our tests
const formatTransformations = [
  // xano_list_instances
  {
    pattern: /text: `🏢 Xano Instances.*?\n.*?` \+ JSON\.stringify\({ instances: result }, null, 2\)/s,
    replacement: `text: \`🏢 Xano Instances - \${result.length} instance(s) found\\n${separator}\\n\\n\` + JSON.stringify({ instances: result }, null, 2)`
  },
  
  // xano_browse_api_groups  
  {
    pattern: /text: "🎯 API Groups:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`🎯 API Groups - \${result.items.length} group(s) | Page \${result.curPage}/\${result.totPage}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_get_api_group
  {
    pattern: /text: "📁 API Group Details:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`📁 API Group - "\${result.name}" | \${result.tag?.length || 0} tags | Swagger: \${result.swagger}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_browse_apis_in_group
  {
    pattern: /text: "🔌 APIs in Group:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`🔌 APIs in Group - \${result.items.length} API(s) | Page \${result.curPage}/\${result.totPage}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_list_files
  {
    pattern: /text: "📁 Files:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`📁 Files - \${result.items.length} file(s) | Page \${result.curPage}/\${result.totPage}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_list_databases
  {
    pattern: /text: "💾 Xano Databases:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`💾 Xano Databases - \${result.databases.length} workspace(s) found\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_get_instance_details
  {
    pattern: /text: "🏗️ Instance Details:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`🏗️ Instance Details - "\${result.display}" | Rate limit: \${result.rate_limit}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_get_workspace_details
  {
    pattern: /text: "🗂️ Workspace Details:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`🗂️ Workspace Details - "\${result.name}" | ID: \${result.id} | Branch: \${result.branch}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_list_tables
  {
    pattern: /text: "📋 Tables:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`📋 Tables - \${result.tables.items.length} table(s) | Page \${result.tables.curPage}/\${result.tables.totPage}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_get_table_details
  {
    pattern: /text: "📋 Table Details:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`📋 Table Details - "\${result.name}" | ID: \${result.id} | Auth: \${result.auth}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_get_table_schema
  {
    pattern: /text: "🔧 Table Schema:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`🔧 Table Schema - \${result.data.schema.length} fields | Table: \${tableId}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_list_functions
  {
    pattern: /text: `⚡ Functions - \${result\.data\.items\.length} function\(s\).*?\n.*?` \+ JSON\.stringify\(result, null, 2\)/s,
    replacement: `text: \`⚡ Functions - \${result.data.items.length} function(s) | Page \${result.data.curPage}/\${result.data.totPage}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_get_function_details
  {
    pattern: /text: `⚡ Function Details - "\${result\.name}".*?\n.*?` \+ JSON\.stringify\(result, null, 2\)/s,
    replacement: `text: \`⚡ Function Details - "\${result.name}" | ID: \${result.id} | Draft: \${result._draft_last_update ? 'Yes' : 'No'}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_list_tasks
  {
    pattern: /text: `⏰ Tasks - \${result\.data\.items\.length} task\(s\).*?\n.*?` \+ JSON\.stringify\(result, null, 2\)/s,
    replacement: `text: \`⏰ Tasks - \${result.data.items.length} task(s) | Page \${result.data.curPage}/\${result.data.totPage}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_get_task_details
  {
    pattern: /text: `⏰ Task Details - "\${result\.name}".*?\n.*?` \+ JSON\.stringify\(result, null, 2\)/s,
    replacement: `text: \`⏰ Task Details - "\${result.name}" | ID: \${result.id} | Active: \${result.active === null || result.active === undefined ? 'N/A' : String(result.active)} | Draft: \${result._draft_last_update ? 'Yes' : 'No'}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // Success messages for create/update/delete operations
  {
    pattern: /message: "🗑️ TABLE DELETED: " \+ "Table deleted successfully"/,
    replacement: `message: \`🗑️ Table Deleted - ID: \${tableId} | Workspace: \${workspaceId}\\n${separator}\\nTable deleted successfully\``
  },
  
  {
    pattern: /message: "📤 EXPORT COMPLETE: " \+ "Workspace export complete"/,
    replacement: `message: \`📤 Workspace Exported - ID: \${workspaceId} | Data included: \${includeData}\\n${separator}\\nWorkspace export complete\``
  },
  
  // Error formatting
  {
    pattern: /text: `❌ Error: \${result\.error}`/g,
    replacement: `text: \`❌ Tool Failed - \${result.error}\\n${separator}\\n\${result.error}\``
  },
  
  // xano_create_table
  {
    pattern: /message: "📊 TABLE CREATED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`📊 Table Created - ID: \${result.id} | Workspace: \${workspaceId}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_create_api_group
  {
    pattern: /message: "✨ API GROUP CREATED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`✨ API Group Created - ID: \${result.id} | Name: "\${result.name}"\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_create_api
  {
    pattern: /message: "🚀 API CREATED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`🚀 API Created - ID: \${result.id} | \${result.verb} \${result.path || ''} | Auth: \${result.auth}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_update_table
  {
    pattern: /message: "✏️ TABLE UPDATED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`✏️ Table Updated - ID: \${tableId} | Fields modified\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_update_api_group
  {
    pattern: /message: "✏️ API GROUP UPDATED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`✏️ API Group Updated - ID: \${apiGroupId} | Updated at: \${new Date().toISOString()}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_update_api
  {
    pattern: /message: "✏️ API UPDATED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`✏️ API Updated - ID: \${apiId} | Updated at: \${new Date().toISOString()}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_delete_api_group
  {
    pattern: /message: "🗑️ API GROUP DELETED: " \+ "API group deleted successfully"/,
    replacement: `message: \`🗑️ API Group Deleted - ID: \${apiGroupId} | Workspace: \${workspaceId}\\n${separator}\\nAPI group deleted successfully\``
  },
  
  // xano_delete_api
  {
    pattern: /message: "🗑️ API DELETED: " \+ "API deleted successfully"/,
    replacement: `message: \`🗑️ API Deleted - ID: \${apiId} from Group \${apiGroupId}\\n${separator}\\nAPI deleted successfully\``
  },
  
  // xano_browse_table_content
  {
    pattern: /text: "📋 Table Content:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`📋 Table Content - \${result.data.items.length} record(s) | Page \${page}/\${Math.ceil(result.data.totItems / perPage)}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_get_table_record
  {
    pattern: /text: "📄 Record Details:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`📄 Record Details - ID: \${result.id} | \${result.email || result.name || ''}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_create_table_record
  {
    pattern: /message: "➕ RECORD CREATED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`➕ Record Created - ID: \${result.data.id} | \${result.data.email || result.data.name || ''}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_update_table_record
  {
    pattern: /message: "✏️ RECORD UPDATED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`✏️ Record Updated - ID: \${recordId} | Fields modified\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_delete_table_record
  {
    pattern: /message: "🗑️ RECORD DELETED: " \+ "Record deleted successfully"/,
    replacement: `message: \`🗑️ Record Deleted - ID: \${recordId} from Table \${tableId}\\n${separator}\\nRecord deleted successfully\``
  },
  
  // xano_bulk_create_records
  {
    pattern: /message: "➕ BULK CREATE: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`➕ Bulk Create - \${result.data.length} record(s) created | IDs: [\${result.data.join(', ')}]\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_bulk_update_records
  {
    pattern: /message: "✏️ BULK UPDATE: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`✏️ Bulk Update - \${result.data.update_count} record(s) modified | IDs: [\${result.data.updated_records.join(', ')}]\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_add_field_to_schema
  {
    pattern: /message: "➕ FIELD ADDED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`➕ Field Added - "\${fieldName}" (\${fieldType}) to Table \${tableId}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_rename_schema_field
  {
    pattern: /message: "✏️ FIELD RENAMED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`✏️ Field Renamed - "\${oldName}" → "\${newName}" | Table: \${tableId}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_delete_field
  {
    pattern: /message: "🗑️ FIELD DELETED: " \+ "Field deleted successfully"/,
    replacement: `message: \`🗑️ Field Deleted - "\${fieldName}" from Table \${tableId}\\n${separator}\\nField deleted successfully\``
  },
  
  // Additional tools
  {
    pattern: /text: "🌿 Workspace Branches:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`🌿 Workspace Branches - \${result.length} branch(es) | Live: \${result.find(b => b.is_live)?.name || 'none'}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  {
    pattern: /text: "📊 Request History:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`📊 Request History - \${result.items.length} request(s) | Page \${result.curPage}/\${result.totPage}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  {
    pattern: /text: "🔐 Authentication Details:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`🔐 Authentication - User: "\${result.name}" | ID: \${result.id} | Email: \${result.email}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  {
    pattern: /text: "📤 File Uploaded:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`📤 File Uploaded - "\${result.name}" | Size: \${result.size} bytes | ID: \${result.id}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  {
    pattern: /message: "🧹 TABLE TRUNCATED: " \+ "Table truncated successfully"/,
    replacement: `message: \`🧹 Table Truncated - ID: \${tableId} | Primary key reset: \${reset}\\n${separator}\\nTable truncated successfully\``
  },
  
  {
    pattern: /message: "🗂️ BTREE INDEX CREATED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`🗂️ BTree Index Created - ID: \${result.data.id} | \${fields.length} field(s) | Table: \${tableId}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  {
    pattern: /message: "🔍 SEARCH INDEX CREATED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`🔍 Search Index Created - "\${name}" | \${fields.length} field(s) | Table: \${tableId}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // Function create/update/publish
  {
    pattern: /message: "✨ FUNCTION CREATED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`✨ Function Created - "\${result.data.name}" | ID: \${result.data.id} | Draft: \${result.data._draft_last_update ? 'Yes' : 'No'}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  {
    pattern: /message: "✏️ FUNCTION UPDATED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`✏️ Function Updated - ID: \${functionId} | Draft created\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  {
    pattern: /message: "🚀 FUNCTION PUBLISHED: " \+ "Function published successfully"/,
    replacement: `message: \`🚀 Function Published - ID: \${functionId} | Now live\\n${separator}\\nFunction published successfully\``
  },
  
  // API with logic
  {
    pattern: /text: "📝 API Logic:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`📝 API Logic - "\${result.name}" | \${result.verb} | \${result.input?.length || 0} inputs | Draft: \${result._draft_last_update ? 'Yes' : 'No'}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  {
    pattern: /message: "🚀 API WITH LOGIC CREATED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`🚀 API Created - "\${result.data.name}" | \${result.data.verb} | ID: \${result.data.id} | \${result.data.input?.length || 0} inputs\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  {
    pattern: /message: "✏️ API LOGIC UPDATED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`✏️ API Logic Updated - ID: \${apiId} | Draft saved\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  {
    pattern: /message: "🚀 API PUBLISHED: " \+ "API published successfully"/,
    replacement: `message: \`🚀 API Published - ID: \${apiId} | Group: \${apiGroupId} | Now live\\n${separator}\\nAPI published successfully\``
  },
  
  // Tasks
  {
    pattern: /message: "➕ TASK CREATED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`➕ Task Created - "\${result.data.name}" | ID: \${result.data.id} | Active: \${result.data.active}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  {
    pattern: /message: "✏️ TASK UPDATED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`✏️ Task Updated - ID: \${taskId} | Draft created\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  {
    pattern: /message: "🚀 TASK PUBLISHED: " \+ "Task published successfully"/,
    replacement: `message: \`🚀 Task Published - ID: \${taskId} | Now active: true\\n${separator}\\nTask published successfully\``
  },
  
  {
    pattern: /message: "🔄 TASK STATUS: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`🔄 Task Status - ID: \${taskId} | Active: \${active} | Draft created\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // Schema export
  {
    pattern: /message: "📤 SCHEMA EXPORTED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`📤 Schema Exported - Workspace: \${workspaceId} | Branch: \${branch || 'live'}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // Table with script
  {
    pattern: /text: "🏗️ TABLE CREATED WITH SCRIPT: " \+ JSON\.stringify\(result\)/,
    replacement: `text: \`🏗️ Table Created - "\${result.name}" | \${result.field_count || 'N/A'} fields defined\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  {
    pattern: /text: "📜 Table Script:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`📜 Table Script - "\${result.name}" | ID: \${result.id} | \${result.script?.length || 0} characters\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  {
    pattern: /message: "✏️ TABLE SCHEMA UPDATED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`✏️ Table Schema Updated - ID: \${tableId} | Script applied\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // Function/block templates
  {
    pattern: /text: "🧱 Function Template:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`🧱 Function Template - "\${functionName}" | Type: XanoScript\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  {
    pattern: /text: "📋 Block Template:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`📋 Block Template - "\${blockName}" | Type: XanoScript\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  {
    pattern: /text: "🚀 XanoScript Setup Guide:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`🚀 XanoScript Setup Guide - Quick reference loaded\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  {
    pattern: /text: "🔧 Line Validation Result:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`🔧 Line Validation - \${result.valid ? 'Valid' : 'Invalid'} | Context: \${context || 'N/A'}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // Debug tools
  {
    pattern: /text: "👤 Current User:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`👤 Current User - ID: \${result.userId} | Authenticated: \${result.authenticated}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  {
    pattern: /text: "👋 Hello Response:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`👋 Hello - \${result.greeting || name} | User ID: \${result.userId}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  {
    pattern: /message: "🗑️ TOKENS EXPIRED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`🗑️ Tokens Expired - \${result.deleted.oauth_tokens + result.deleted.xano_auth_tokens} token(s) deleted\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  {
    pattern: /text: "📋 Active Sessions:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`📋 Active Sessions - \${result.sessionCount} session(s) found\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // File operations
  {
    pattern: /message: "🗑️ FILE DELETED: " \+ "File deleted successfully"/,
    replacement: `message: \`🗑️ File Deleted - ID: \${fileId} | Workspace: \${workspaceId}\\n${separator}\\nFile deleted successfully\``
  },
  
  {
    pattern: /message: "🗑️ BRANCH DELETED: " \+ "Branch deleted successfully"/,
    replacement: `message: \`🗑️ Branch Deleted - "\${branchName}" from Workspace \${workspaceId}\\n${separator}\\nBranch deleted successfully\``
  },
  
  {
    pattern: /message: "🗑️ FUNCTION DELETED: " \+ "Function deleted successfully"/,
    replacement: `message: \`🗑️ Function Deleted - ID: \${functionId} | Workspace: \${workspaceId}\\n${separator}\\nFunction deleted successfully\``
  },
  
  {
    pattern: /message: "🗑️ TASK DELETED: " \+ "Task deleted successfully"/,
    replacement: `message: \`🗑️ Task Deleted - ID: \${taskId} | Workspace: \${workspaceId}\\n${separator}\\nTask deleted successfully\``
  },
  
  // List APIs with logic
  {
    pattern: /text: "📋 APIs with Logic:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`📋 APIs with Logic - \${result.data.items.length} API(s) | Group: \${apiGroupId}\\n${separator}\\n\` + JSON.stringify(result, null, 2)`
  }
];

// Apply all transformations
let replacementCount = 0;
formatTransformations.forEach((transformation, index) => {
  const beforeLength = content.length;
  content = content.replace(transformation.pattern, transformation.replacement);
  if (content.length !== beforeLength) {
    replacementCount++;
    console.log(`✅ Applied transformation ${index + 1}: ${transformation.pattern.source?.substring(0, 50)}...`);
  }
});

// Write the updated content back
fs.writeFileSync(filePath, content);

console.log(`\n✅ Ultimate format implementation complete! Applied ${replacementCount} transformations.`);