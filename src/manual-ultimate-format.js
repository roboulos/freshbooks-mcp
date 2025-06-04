const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, 'index.ts');
let content = fs.readFileSync(filePath, 'utf8');

console.log('🔧 Manually applying ULTIMATE format to key tools...');

const separator = '='.repeat(50);

// Manual replacements for each tool type
const replacements = [
  // xano_list_instances
  {
    find: 'text: "🏢 XANO INSTANCES\\n\\n" + JSON.stringify({\n                emoji: "🏢 XANO INSTANCES",\n                instance_name: instance_name,\n                instances: result\n              }, null, 2)',
    replace: `text: \`🏢 Xano Instances - \${result.length} instance(s) found\\n${separator}\\n\\n\` + JSON.stringify({
                instance_name: instance_name,
                instances: result
              }, null, 2)`
  },
  
  // xano_browse_api_groups  
  {
    find: 'text: "📦 API GROUPS\\n\\n" + JSON.stringify(result, null, 2)',
    replace: `text: (() => {
              const page = result.curPage || 1;
              const items = result.items || [];
              const total = result.total || items.length;
              const perPage = result.perPage || 50;
              const totalPages = Math.ceil(total / perPage);
              return \`🎯 API Groups - \${items.length} group(s) | Page \${page}/\${totalPages}\\n${separator}\\n\\n\` + JSON.stringify(result, null, 2);
            })()`
  },
  
  // xano_get_api_group
  {
    find: 'text: "📦 API GROUP DETAILS\\n\\n" + JSON.stringify(result, null, 2)',
    replace: `text: \`📁 API Group - "\${result.name || 'Unknown'}" | \${result.tag?.length || 0} tags | Swagger: \${result.swagger || false}\\n${separator}\\n\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_create_table_record
  {
    find: 'text: "➕ RECORD CREATED\\n\\n" + JSON.stringify({\n                success: true,\n                data: result,\n                operation: "xano_create_table_record"\n              }, null, 2)',
    replace: `text: (() => {
              const keyInfo = result.name || result.email || result.title || '';
              return \`➕ Record Created - ID: \${result.id || 'N/A'}\${keyInfo ? \` | \${keyInfo}\` : ''}\\n${separator}\\n\\n\` + JSON.stringify({
                success: true,
                data: result,
                operation: "xano_create_table_record"
              }, null, 2);
            })()`
  },
  
  // xano_update_table_record
  {
    find: 'text: "✏️ RECORD UPDATED\\n\\n" + JSON.stringify({\n                success: true,\n                data: result,\n                operation: "xano_update_table_record"\n              }, null, 2)',
    replace: `text: \`✏️ Record Updated - ID: \${record_id} | \${Object.keys(record_data || {}).length} field(s) modified\\n${separator}\\n\\n\` + JSON.stringify({
                success: true,
                data: result,
                operation: "xano_update_table_record"
              }, null, 2)`
  },
  
  // xano_delete_table_record
  {
    find: 'message: `🗑️ RECORD DELETED: Record ${record_id} deleted successfully`',
    replace: `message: \`Record \${record_id} deleted successfully\`,
                emoji_header: \`🗑️ Record Deleted - ID: \${record_id} from Table \${table_id}\\n${separator}\\n\\n\``
  },
  
  // xano_browse_apis_in_group
  {
    find: 'text: "🔌 API LIST\\n\\n" + JSON.stringify(result, null, 2)',
    replace: `text: (() => {
              const page = result.curPage || 1;
              const items = result.items || [];
              const total = result.total || items.length;
              const perPage = result.perPage || 50;
              const totalPages = Math.ceil(total / perPage);
              return \`🔌 APIs in Group - \${items.length} API(s) | Page \${page}/\${totalPages}\\n${separator}\\n\\n\` + JSON.stringify(result, null, 2);
            })()`
  },
  
  // xano_list_files
  {
    find: 'text: "📁 FILES LIST\\n\\n" + JSON.stringify(result, null, 2)',
    replace: `text: (() => {
              const page = result.curPage || 1;
              const items = result.items || [];
              const total = result.total || items.length;
              const perPage = result.perPage || 50;
              const totalPages = Math.ceil(total / perPage);
              return \`📁 Files - \${items.length} file(s) | Page \${page}/\${totalPages}\\n${separator}\\n\\n\` + JSON.stringify(result, null, 2);
            })()`
  },
  
  // xano_list_databases
  {
    find: 'text: "💾 XANO DATABASES\\n\\n" + JSON.stringify({\n                emoji: "💾 XANO DATABASES",\n                instance_name: instance_name,\n                databases: result\n              }, null, 2)',
    replace: `text: \`💾 Xano Databases - \${result.length} workspace(s) found\\n${separator}\\n\\n\` + JSON.stringify({
                instance_name: instance_name,
                databases: result
              }, null, 2)`
  },
  
  // xano_list_tables
  {
    find: 'text: "📊 TABLES LIST\\n\\n" + JSON.stringify({\n                emoji: "📊 TABLES LIST",\n                workspace_id: database_id,\n                tables: result\n              }, null, 2)',
    replace: `text: (() => {
              const page = result.curPage || 1;
              const items = result.items || [];
              const total = result.total || items.length;
              const perPage = result.perPage || 50;
              const totalPages = Math.ceil(total / perPage);
              return \`📋 Tables - \${items.length} table(s) | Page \${page}/\${totalPages}\\n${separator}\\n\\n\` + JSON.stringify({
                workspace_id: database_id,
                tables: result
              }, null, 2);
            })()`
  },
  
  // xano_create_api_with_logic
  {
    find: 'emoji: "🚀 API CREATED",\n                success: true,\n                message: "API endpoint created successfully with full XanoScript logic"',
    replace: `success: true,
                message: \`API endpoint created successfully with full XanoScript logic\`,
                emoji_header: \`🚀 API Created - "\${result.name || 'Unknown'}" | \${result.verb || 'GET'} | ID: \${result.id || 'N/A'} | \${result.input?.length || 0} inputs\\n${separator}\\n\\n\``
  },
  
  // Error responses
  {
    find: 'text: "❌ ERROR\\n\\n" + JSON.stringify(',
    replace: `text: \`❌ Operation Failed - \${error.message || 'Unknown error'}\\n${separator}\\n\\n\` + JSON.stringify(`
  },
  
  // Hello greeting
  {
    find: 'text: "👋 GREETING\\n\\n" + `Hello, ${name}!`',
    replace: `text: \`👋 Hello - \${name} | User ID: \${this.props?.userId || 'N/A'}\\n${separator}\\n\\nHello, \${name}!\``
  },
  
  // whoami
  {
    find: 'text: "👤 USER PROFILE\\n\\n" + `Welcome, ${name}!',
    replace: `text: \`👤 Current User - ID: \${this.props?.userId || 'N/A'} | Authenticated: \${!!this.props?.userId}\\n${separator}\\n\\nWelcome, \${name}!`
  }
];

// Apply each replacement
let changeCount = 0;
replacements.forEach(({ find, replace }, index) => {
  const before = content.length;
  content = content.replace(find, replace);
  if (content.length !== before) {
    changeCount++;
    console.log(`✅ Applied replacement ${index + 1}: ${find.substring(0, 50)}...`);
  }
});

// Write the updated file
fs.writeFileSync(filePath, content);
console.log(`\n✅ Manual format update complete! Applied ${changeCount} replacements.`);