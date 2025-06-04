const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, 'index.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Define comprehensive emoji mappings for tool responses
const emojiReplacements = [
  // Debug operations
  {
    search: 'message: `Deleted ${deletedCount} authentication tokens`',
    replace: 'emoji: "🗑️ TOKEN CLEANUP",\n                message: `Deleted ${deletedCount} authentication tokens`'
  },
  {
    search: 'keyCount: keys.length,',
    replace: 'emoji: "🔑 KV STORAGE DEBUG",\n                keyCount: keys.length,'
  },
  {
    search: 'userId: this.props.userId,\n                name: this.props.userDetails?.name,',
    replace: 'emoji: "👤 USER PROFILE",\n                userId: this.props.userId,\n                name: this.props.userDetails?.name,'
  },
  {
    search: 'success: !!sessionInfo,\n                sessionInfo: sessionInfo,',
    replace: 'emoji: "📊 SESSION STATUS",\n                success: !!sessionInfo,\n                sessionInfo: sessionInfo,'
  },
  {
    search: 'success: result.success,\n                sessionCount: result.sessions?.length || 0,',
    replace: 'emoji: "📋 ACTIVE SESSIONS",\n                success: result.success,\n                sessionCount: result.sessions?.length || 0,'
  },
  {
    search: 'action: action,\n                sessionId: sessionId,',
    replace: 'emoji: "🔧 SESSION CONTROL",\n                action: action,\n                sessionId: sessionId,'
  },
  
  // Instance operations
  {
    search: 'instances: result,',
    replace: 'emoji: "🏢 XANO INSTANCES",\n                instances: result,'
  },
  {
    search: 'instance_name: instance_name,\n                instance: result',
    replace: 'emoji: "🏢 INSTANCE DETAILS",\n                instance_name: instance_name,\n                instance: result'
  },
  
  // Database operations
  {
    search: 'instance_name: instance_name,\n                databases: result',
    replace: 'emoji: "🗄️ DATABASES",\n                instance_name: instance_name,\n                databases: result'
  },
  {
    search: 'workspace_id: workspace_id,\n                workspace: result',
    replace: 'emoji: "📁 WORKSPACE DETAILS",\n                workspace_id: workspace_id,\n                workspace: result'
  },
  {
    search: 'workspace_id: database_id,\n                tables: result',
    replace: 'emoji: "📊 TABLES LIST",\n                workspace_id: database_id,\n                tables: result'
  },
  
  // Add emoji to table operations
  {
    search: 'success: true,\n                data: result,\n                operation: "xano_get_table_details"',
    replace: 'emoji: "📊 TABLE DETAILS",\n                success: true,\n                data: result,\n                operation: "xano_get_table_details"'
  },
  {
    search: 'success: true,\n                data: result,\n                operation: "xano_get_table_schema"',
    replace: 'emoji: "🏗️ TABLE SCHEMA",\n                success: true,\n                data: result,\n                operation: "xano_get_table_schema"'
  },
  {
    search: 'success: true,\n                message: "Table created successfully",',
    replace: 'emoji: "✅ TABLE CREATED",\n                success: true,\n                message: "Table created successfully",'
  },
  {
    search: 'success: true,\n                message: "Table updated successfully",',
    replace: 'emoji: "✏️ TABLE UPDATED",\n                success: true,\n                message: "Table updated successfully",'
  },
  {
    search: 'success: true,\n                message: "Table deleted successfully",',
    replace: 'emoji: "🗑️ TABLE DELETED",\n                success: true,\n                message: "Table deleted successfully",'
  },
  
  // Field operations
  {
    search: 'success: true,\n                data: result || { message: "Field added successfully" },\n                operation: "xano_add_field_to_schema"',
    replace: 'emoji: "➕ FIELD ADDED",\n                success: true,\n                data: result || { message: "Field added successfully" },\n                operation: "xano_add_field_to_schema"'
  },
  {
    search: 'success: true,\n                data: result || { message: "Field renamed successfully" },\n                operation: "xano_rename_schema_field"',
    replace: 'emoji: "✏️ FIELD RENAMED",\n                success: true,\n                data: result || { message: "Field renamed successfully" },\n                operation: "xano_rename_schema_field"'
  },
  {
    search: 'success: true,\n                message: "Field deleted successfully",\n                operation: "xano_delete_field"',
    replace: 'emoji: "🗑️ FIELD DELETED",\n                success: true,\n                message: "Field deleted successfully",\n                operation: "xano_delete_field"'
  },
  
  // Record operations
  {
    search: 'page: page,\n                per_page: per_page,\n                records: result',
    replace: 'emoji: "📊 TABLE RECORDS",\n                page: page,\n                per_page: per_page,\n                records: result'
  },
  {
    search: 'record_id: record_id,\n                record: result',
    replace: 'emoji: "📄 RECORD DETAILS",\n                record_id: record_id,\n                record: result'
  },
  {
    search: 'success: true,\n                data: result,\n                operation: "xano_create_table_record"',
    replace: 'emoji: "➕ RECORD CREATED",\n                success: true,\n                data: result,\n                operation: "xano_create_table_record"'
  },
  {
    search: 'success: true,\n                data: result,\n                operation: "xano_update_table_record"',
    replace: 'emoji: "✏️ RECORD UPDATED",\n                success: true,\n                data: result,\n                operation: "xano_update_table_record"'
  },
  {
    search: 'success: true,\n                message: `Record ${record_id} deleted successfully`',
    replace: 'emoji: "🗑️ RECORD DELETED",\n                success: true,\n                message: `Record ${record_id} deleted successfully`'
  },
  
  // File operations
  {
    search: 'page: page,\n                per_page: per_page,\n                files: result',
    replace: 'emoji: "📁 FILES LIST",\n                page: page,\n                per_page: per_page,\n                files: result'
  },
  {
    search: 'success: true,\n                message: "File uploaded successfully",\n                data: result',
    replace: 'emoji: "📤 FILE UPLOADED",\n                success: true,\n                message: "File uploaded successfully",\n                data: result'
  },
  {
    search: 'success: true,\n                data: result,\n                operation: "xano_list_files"',
    replace: 'emoji: "📁 FILES LIST",\n                success: true,\n                data: result,\n                operation: "xano_list_files"'
  },
  
  // Branch operations
  {
    search: 'workspace_id: workspace_id,\n                branches: result',
    replace: 'emoji: "🌿 BRANCHES",\n                workspace_id: workspace_id,\n                branches: result'
  },
  
  // API Group operations  
  {
    search: 'page: page,\n                per_page: per_page,\n                api_groups: result',
    replace: 'emoji: "📦 API GROUPS",\n                page: page,\n                per_page: per_page,\n                api_groups: result'
  },
  {
    search: 'api_group_id: api_group_id,\n                api_group: result',
    replace: 'emoji: "📦 API GROUP DETAILS",\n                api_group_id: api_group_id,\n                api_group: result'
  },
  
  // Function operations
  {
    search: 'success: true,\n                data: result,\n                operation: "xano_list_functions"',
    replace: 'emoji: "⚡ FUNCTIONS LIST",\n                success: true,\n                data: result,\n                operation: "xano_list_functions"'
  },
  {
    search: 'success: true,\n                data: result,\n                operation: "xano_get_function_details"',
    replace: 'emoji: "⚡ FUNCTION DETAILS",\n                success: true,\n                data: result,\n                operation: "xano_get_function_details"'
  },
  
  // Task operations
  {
    search: 'success: true,\n                data: result,\n                operation: "xano_list_tasks"',
    replace: 'emoji: "⏰ TASKS LIST",\n                success: true,\n                data: result,\n                operation: "xano_list_tasks"'
  },
  {
    search: 'success: true,\n                data: result,\n                operation: "xano_get_task_details"',
    replace: 'emoji: "⏰ TASK DETAILS",\n                success: true,\n                data: result,\n                operation: "xano_get_task_details"'
  },
  
  // API with logic operations
  {
    search: 'success: true,\n                data: result,\n                operation: "xano_get_api_with_logic"',
    replace: 'emoji: "🔌 API LOGIC",\n                success: true,\n                data: result,\n                operation: "xano_get_api_with_logic"'
  },
  {
    search: 'success: true,\n                data: result,\n                operation: "xano_list_apis_with_logic"',
    replace: 'emoji: "🔌 API LIST",\n                success: true,\n                data: result,\n                operation: "xano_list_apis_with_logic"'
  },
  
  // Table with script operations
  {
    search: 'success: true,\n                data: result,\n                operation: "xano_get_table_with_script"',
    replace: 'emoji: "🏗️ TABLE SCHEMA",\n                success: true,\n                data: result,\n                operation: "xano_get_table_with_script"'
  },
  
  // Simple responses
  {
    search: 'message: `Hello, ${name}!`',
    replace: 'emoji: "👋 GREETING",\n                message: `Hello, ${name}!`'
  }
];

// Apply all replacements
emojiReplacements.forEach((replacement, index) => {
  const before = content;
  content = content.replace(replacement.search, replacement.replace);
  if (before !== content) {
    console.log(`✅ Applied replacement ${index + 1}: ${replacement.replace.split(',')[0]}`);
  }
});

// Write the updated content back
fs.writeFileSync(filePath, content);
console.log('\n🎉 Emojis added to tool responses successfully!');