const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, 'index.ts');
const content = fs.readFileSync(filePath, 'utf8');

console.log('🔍 Verifying Ultimate Format coverage...\n');

// List of all 69 tools
const allTools = [
  'xano_list_instances',
  'xano_browse_api_groups',
  'xano_get_api_group',
  'xano_browse_apis_in_group',
  'xano_create_api',
  'xano_get_api',
  'xano_update_api',
  'xano_delete_api',
  'xano_list_files',
  'xano_upload_file',
  'xano_delete_file',
  'xano_list_workspace_branches',
  'xano_delete_workspace_branch',
  'xano_browse_request_history',
  'xano_list_databases',
  'xano_get_instance_details',
  'xano_get_workspace_details',
  'xano_list_tables',
  'xano_get_table_details',
  'xano_get_table_schema',
  'xano_create_table',
  'xano_update_table',
  'xano_delete_table',
  'xano_add_field_to_schema',
  'xano_rename_schema_field',
  'xano_delete_field',
  'xano_browse_table_content',
  'xano_get_table_record',
  'xano_create_table_record',
  'xano_update_table_record',
  'xano_delete_table_record',
  'xano_bulk_create_records',
  'xano_bulk_update_records',
  'xano_auth_me',
  'xano_list_functions',
  'xano_create_function',
  'xano_get_function_details',
  'xano_delete_function',
  'xano_update_function',
  'xano_publish_function',
  'xano_create_btree_index',
  'xano_create_search_index',
  'xano_create_api_with_logic',
  'xano_get_api_with_logic',
  'xano_update_api_with_logic',
  'xano_list_apis_with_logic',
  'xano_publish_api',
  'xano_create_task',
  'xano_list_tasks',
  'xano_get_task_details',
  'xano_update_task',
  'xano_delete_task',
  'xano_publish_task',
  'xano_activate_task',
  'xano_create_table_with_script',
  'xano_get_table_with_script',
  'xano_update_table_with_script',
  'xano_export_workspace',
  'xano_export_workspace_schema',
  'xano_truncate_table',
  'xano_get_function_template',
  'xano_get_block_template',
  'xano_get_started',
  'xano_validate_line',
  'whoami',
  'hello',
  'debug_expire_oauth_tokens',
  'debug_list_active_sessions',
  'xano_create_api_group',
  'xano_update_api_group',
  'xano_delete_api_group'
];

const separator = '='.repeat(50);
const formatted = [];
const notFormatted = [];

// Check each tool
allTools.forEach(tool => {
  // Look for the tool definition
  const toolRegex = new RegExp(`this\\.server\\.tool\\(\\s*["'\`]${tool}["'\`]`, 'g');
  const toolMatch = content.match(toolRegex);
  
  if (toolMatch) {
    // Check if it has the separator in its response
    const toolIndex = content.indexOf(toolMatch[0]);
    const nextToolIndex = content.indexOf('this.server.tool(', toolIndex + 1);
    const toolSection = content.substring(toolIndex, nextToolIndex > 0 ? nextToolIndex : content.length);
    
    if (toolSection.includes(separator)) {
      formatted.push(tool);
    } else {
      notFormatted.push(tool);
    }
  } else {
    console.log(`⚠️  Tool not found: ${tool}`);
  }
});

console.log(`\n✅ Formatted tools (${formatted.length}):`);
formatted.forEach(tool => console.log(`   - ${tool}`));

console.log(`\n❌ Not formatted tools (${notFormatted.length}):`);
notFormatted.forEach(tool => console.log(`   - ${tool}`));

console.log(`\n📊 Coverage: ${formatted.length}/${allTools.length} (${Math.round((formatted.length / allTools.length) * 100)}%)`);

// Generate update script for remaining tools
if (notFormatted.length > 0) {
  console.log('\n📝 Generating update patterns for remaining tools...');
  const updatePatterns = [];
  
  notFormatted.forEach(tool => {
    // Find the tool in content and extract its response pattern
    const toolRegex = new RegExp(`this\\.server\\.tool\\(\\s*["'\`]${tool}["'\`]`, 'g');
    const toolMatch = content.match(toolRegex);
    
    if (toolMatch) {
      const toolIndex = content.indexOf(toolMatch[0]);
      const nextToolIndex = content.indexOf('this.server.tool(', toolIndex + 1);
      const toolSection = content.substring(toolIndex, nextToolIndex > 0 ? nextToolIndex : toolIndex + 2000);
      
      // Extract current format patterns
      const textPatterns = toolSection.match(/text: ["'`].*?["'`]/gs);
      const messagePatterns = toolSection.match(/message: ["'`].*?["'`]/gs);
      
      if (textPatterns || messagePatterns) {
        console.log(`\n   ${tool}:`);
        if (textPatterns) textPatterns.slice(0, 2).forEach(p => console.log(`     - ${p.substring(0, 60)}...`));
        if (messagePatterns) messagePatterns.slice(0, 2).forEach(p => console.log(`     - ${p.substring(0, 60)}...`));
      }
    }
  });
}