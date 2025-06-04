const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, 'index.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Define emoji mappings for different operations
const emojiMappings = [
  // Debug operations
  { pattern: /message: `Deleted \$\{deletedCount\} authentication tokens`/, emoji: '🗑️ TOKEN CLEANUP', field: 'message' },
  { pattern: /keyCount: keys\.length/, emoji: '🔑 KV STORAGE', prepend: true },
  { pattern: /userId: this\.props\.userId/, emoji: '👤 USER PROFILE', prepend: true },
  { pattern: /success: !!sessionInfo/, emoji: '📊 SESSION STATUS', prepend: true },
  { pattern: /sessionCount: result\.sessions\?\.length/, emoji: '📋 ACTIVE SESSIONS', prepend: true },
  { pattern: /action: action/, emoji: '🔧 SESSION CONTROL', prepend: true },
  
  // Hello test
  { pattern: /message: `Hello, \$\{name\}!`/, emoji: '👋 GREETING', field: 'message' },
  
  // Instance operations
  { pattern: /instances: result/, emoji: '🏢 XANO INSTANCES', prepend: true },
  { pattern: /instance: result/, emoji: '🏢 INSTANCE DETAILS', prepend: true },
  
  // Database operations
  { pattern: /databases: result/, emoji: '🗄️ DATABASES', prepend: true },
  { pattern: /workspace: result/, emoji: '📁 WORKSPACE', prepend: true },
  { pattern: /tables: result/, emoji: '📊 TABLES', prepend: true },
  { pattern: /data: result,\s*operation: "xano_get_table_schema"/, emoji: '🏗️ TABLE SCHEMA', prepend: true },
  { pattern: /message: "Table created successfully"/, emoji: '✅ TABLE CREATED', field: 'message' },
  { pattern: /message: "Table updated successfully"/, emoji: '✏️ TABLE UPDATED', field: 'message' },
  { pattern: /message: "Table deleted successfully"/, emoji: '🗑️ TABLE DELETED', field: 'message' },
  
  // Field operations
  { pattern: /operation: "xano_add_field_to_schema"/, emoji: '➕ FIELD ADDED', prepend: true },
  { pattern: /operation: "xano_rename_schema_field"/, emoji: '✏️ FIELD RENAMED', prepend: true },
  { pattern: /operation: "xano_delete_field"/, emoji: '🗑️ FIELD DELETED', prepend: true },
  
  // Record operations
  { pattern: /records: result/, emoji: '📊 TABLE RECORDS', prepend: true },
  { pattern: /record: result/, emoji: '📄 RECORD DETAILS', prepend: true },
  { pattern: /operation: "xano_create_table_record"/, emoji: '➕ RECORD CREATED', prepend: true },
  { pattern: /operation: "xano_update_table_record"/, emoji: '✏️ RECORD UPDATED', prepend: true },
  { pattern: /operation: "xano_delete_table_record"/, emoji: '🗑️ RECORD DELETED', prepend: true },
  { pattern: /operation: "xano_bulk_create_records"/, emoji: '➕ BULK CREATE', prepend: true },
  { pattern: /operation: "xano_bulk_update_records"/, emoji: '✏️ BULK UPDATE', prepend: true },
  
  // Auth operations
  { pattern: /user: result/, emoji: '🔐 AUTHENTICATED', prepend: true },
  
  // File operations
  { pattern: /files: result/, emoji: '📁 FILES', prepend: true },
  { pattern: /message: "File uploaded successfully"/, emoji: '📤 FILE UPLOADED', field: 'message' },
  { pattern: /message: `File \$\{file_id\} deleted successfully`/, emoji: '🗑️ FILE DELETED', field: 'message' },
  
  // Branch operations
  { pattern: /branches: result/, emoji: '🌿 BRANCHES', prepend: true },
  { pattern: /message: "Branch deleted successfully"/, emoji: '🗑️ BRANCH DELETED', field: 'message' },
  
  // API Group operations
  { pattern: /api_groups: result/, emoji: '📦 API GROUPS', prepend: true },
  { pattern: /message: "API group created successfully"/, emoji: '➕ API GROUP CREATED', field: 'message' },
  { pattern: /api_group: result/, emoji: '📦 API GROUP DETAILS', prepend: true },
  { pattern: /message: "API group updated successfully"/, emoji: '✏️ API GROUP UPDATED', field: 'message' },
  { pattern: /message: `API group \$\{api_group_id\} deleted successfully`/, emoji: '🗑️ API GROUP DELETED', field: 'message' },
  
  // API operations
  { pattern: /apis: result/, emoji: '🔌 APIS', prepend: true },
  { pattern: /message: "API created successfully"/, emoji: '➕ API CREATED', field: 'message' },
  { pattern: /api: result/, emoji: '🔌 API DETAILS', prepend: true },
  { pattern: /message: "API updated successfully"/, emoji: '✏️ API UPDATED', field: 'message' },
  { pattern: /message: `API \$\{api_id\} deleted successfully from group/, emoji: '🗑️ API DELETED', field: 'message' },
  
  // Export operations
  { pattern: /message: "Workspace export completed successfully"/, emoji: '📤 EXPORT COMPLETE', field: 'message' },
  { pattern: /message: "Schema export completed successfully"/, emoji: '📤 SCHEMA EXPORTED', field: 'message' },
  
  // Request history
  { pattern: /requests: result/, emoji: '📊 REQUEST HISTORY', prepend: true },
  
  // Table operations
  { pattern: /message: `Table \$\{table_id\} truncated successfully`/, emoji: '🧹 TABLE TRUNCATED', field: 'message' },
  { pattern: /operation: "xano_create_btree_index"/, emoji: '🔍 INDEX CREATED', prepend: true },
  { pattern: /operation: "xano_create_search_index"/, emoji: '🔍 SEARCH INDEX', prepend: true },
  
  // Function operations
  { pattern: /operation: "xano_list_functions"/, emoji: '⚡ FUNCTIONS', prepend: true },
  { pattern: /operation: "xano_create_function"/, emoji: '➕ FUNCTION CREATED', prepend: true },
  { pattern: /operation: "xano_get_function_details"/, emoji: '⚡ FUNCTION DETAILS', prepend: true },
  { pattern: /message: `Function \$\{function_id\} deleted successfully`/, emoji: '🗑️ FUNCTION DELETED', field: 'message' },
  { pattern: /message: `Function \$\{function_id\} published to live successfully`/, emoji: '🚀 FUNCTION PUBLISHED', field: 'message' },
  { pattern: /message: `Function \$\{function_id\} updated as draft successfully`/, emoji: '✏️ FUNCTION UPDATED', field: 'message' },
  
  // Task operations
  { pattern: /operation: "xano_list_tasks"/, emoji: '⏰ TASKS', prepend: true },
  { pattern: /message: "Background task created successfully/, emoji: '➕ TASK CREATED', field: 'message' },
  { pattern: /operation: "xano_get_task_details"/, emoji: '⏰ TASK DETAILS', prepend: true },
  { pattern: /message: `Task \$\{task_id\} deleted successfully`/, emoji: '🗑️ TASK DELETED', field: 'message' },
  { pattern: /message: `Task \$\{task_id\} published to live successfully`/, emoji: '🚀 TASK PUBLISHED', field: 'message' },
  { pattern: /message: `Task \$\{task_id\} updated as draft successfully`/, emoji: '✏️ TASK UPDATED', field: 'message' },
  { pattern: /message: `Task \$\{task_id\} \$\{active/, emoji: '🔄 TASK STATUS', field: 'message' },
  
  // API with logic operations
  { pattern: /message: "API endpoint created successfully with full XanoScript logic"/, emoji: '🚀 API CREATED', field: 'message' },
  { pattern: /operation: "xano_get_api_with_logic"/, emoji: '🔌 API LOGIC', prepend: true },
  { pattern: /message: "API logic updated successfully"/, emoji: '✏️ API UPDATED', field: 'message' },
  { pattern: /operation: "xano_list_apis_with_logic"/, emoji: '🔌 API LIST', prepend: true },
  { pattern: /message: `API \$\{api_id\} published to live successfully`/, emoji: '🚀 API PUBLISHED', field: 'message' },
  
  // Table with script operations
  { pattern: /message: "Table created successfully with XanoScript"/, emoji: '🏗️ TABLE CREATED', field: 'message' },
  { pattern: /operation: "xano_get_table_with_script"/, emoji: '🏗️ TABLE SCHEMA', prepend: true },
  { pattern: /message: "Table schema updated successfully"/, emoji: '✏️ SCHEMA UPDATED', field: 'message' },
];

// Apply emoji mappings
emojiMappings.forEach(mapping => {
  if (mapping.prepend) {
    // Add emoji as first field in JSON
    const regex = new RegExp(`text: JSON\\.stringify\\({([\\s\\S]*?)(${mapping.pattern.source})`, 'g');
    content = content.replace(regex, (match, before, pattern) => {
      // Check if emoji already exists
      if (before.includes('"🔍') || before.includes('"📊') || before.includes('"🗑️') || 
          before.includes('"➕') || before.includes('"✏️') || before.includes('"🏗️') ||
          before.includes('"📁') || before.includes('"🔌') || before.includes('"⚡') ||
          before.includes('"⏰') || before.includes('"🚀') || before.includes('"🔐') ||
          before.includes('"📤') || before.includes('"🌿') || before.includes('"🔑') ||
          before.includes('"👤') || before.includes('"📋') || before.includes('"🔧') ||
          before.includes('"👋') || before.includes('"🏢') || before.includes('"🗄️') ||
          before.includes('"📦') || before.includes('"🧹') || before.includes('"🔍') ||
          before.includes('"🔄')) {
        return match; // Already has emoji
      }
      return `text: JSON.stringify({
                "${mapping.emoji}": true,${before}${pattern}`;
    });
  } else if (mapping.field) {
    // Replace specific field value
    const regex = new RegExp(`${mapping.pattern.source}`, 'g');
    content = content.replace(regex, (match) => {
      return match.replace(/message: /, `message: "${mapping.emoji}: " + `);
    });
  }
});

// Write the updated content back
fs.writeFileSync(filePath, content);
console.log('✅ Emojis added to all tool responses!');