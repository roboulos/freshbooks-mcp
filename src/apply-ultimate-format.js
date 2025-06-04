const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, 'index.ts');
let content = fs.readFileSync(filePath, 'utf8');

console.log('🎯 Applying ULTIMATE format to Xano tools...');

const separator = '='.repeat(50);

// Define all the replacements
const replacements = [
  // xano_list_instances
  {
    find: 'text: "🏢 Xano Instances:\\n" + JSON.stringify({ instances: result }, null, 2)',
    replace: `text: \`🏢 Xano Instances - \${result.length} instance(s) found\\n${separator}\\n\\n\` + JSON.stringify({ instances: result }, null, 2)`
  },
  
  // Record operations
  {
    find: 'emoji: "➕ RECORD CREATED",\n                success: true,\n                data: result,\n                operation: "xano_create_table_record"',
    replace: `success: true,\n                data: result,\n                operation: "xano_create_table_record"`
  },
  
  // Then add the header separately
  {
    find: 'text: JSON.stringify({\n                success: true,\n                data: result,\n                operation: "xano_create_table_record"\n              }, null, 2)',
    replace: `text: (() => {
              const keyInfo = result.name || result.email || result.title || '';
              return \`➕ Record Created - ID: \${result.id || 'N/A'}\${keyInfo ? \` | \${keyInfo}\` : ''}\\n${separator}\\n\\n\` + JSON.stringify({
                success: true,
                data: result,
                operation: "xano_create_table_record"
              }, null, 2);
            })()`
  },
  
  // Table deleted
  {
    find: 'message: "🗑️ TABLE DELETED: " + "Table deleted successfully"',
    replace: `message: "Table deleted successfully"`
  },
  
  // Record deleted
  {
    find: 'message: `🗑️ RECORD DELETED: Record ${record_id} deleted successfully`',
    replace: `message: \`Record \${record_id} deleted successfully\``
  },
  
  // Export operations
  {
    find: 'message: "📤 EXPORT COMPLETE: " + "Workspace export completed successfully"',
    replace: `message: "Workspace export completed successfully"`
  },
  
  {
    find: 'message: "📤 SCHEMA EXPORTED: " + "Schema export completed successfully"',
    replace: `message: "Schema export completed successfully"`
  },
  
  // Now add proper headers to JSON responses
  {
    find: 'text: JSON.stringify({\n                  success: true,\n                  message: "Table deleted successfully",\n                  operation: "xano_delete_table"\n                })',
    replace: `text: \`🗑️ Table Deleted - ID: \${table_id} | Workspace: \${workspace_id}\\n${separator}\\n\\n\` + JSON.stringify({
                  success: true,
                  message: "Table deleted successfully",
                  operation: "xano_delete_table"
                }, null, 2)`
  },
  
  {
    find: 'text: JSON.stringify({\n                success: true,\n                message: `Record ${record_id} deleted successfully`\n              }, null, 2)',
    replace: `text: \`🗑️ Record Deleted - ID: \${record_id} from Table \${table_id}\\n${separator}\\n\\n\` + JSON.stringify({
                success: true,
                message: \`Record \${record_id} deleted successfully\`
              }, null, 2)`
  },
  
  {
    find: 'text: JSON.stringify({\n                  success: true,\n                  message: "Workspace export completed successfully",\n                  data: result,\n                  operation: "xano_export_workspace",\n                  note: "Export may include download URL and file information. If include_data was true, table data is included."\n                }, null, 2)',
    replace: `text: \`📤 Workspace Exported - ID: \${workspace_id} | Data included: \${include_data || false}\\n${separator}\\n\\n\` + JSON.stringify({
                  success: true,
                  message: "Workspace export completed successfully",
                  data: result,
                  operation: "xano_export_workspace",
                  note: "Export may include download URL and file information. If include_data was true, table data is included."
                }, null, 2)`
  },
  
  {
    find: 'text: JSON.stringify({\n                  success: true,\n                  message: "Schema export completed successfully",\n                  data: result,\n                  operation: "xano_export_workspace_schema",\n                  note: "Export data may include download URL or file information depending on Xano\'s response"\n                }, null, 2)',
    replace: `text: \`📤 Schema Exported - Workspace: \${workspace_id} | Branch: \${branch || 'live'}\\n${separator}\\n\\n\` + JSON.stringify({
                  success: true,
                  message: "Schema export completed successfully",
                  data: result,
                  operation: "xano_export_workspace_schema",
                  note: "Export data may include download URL or file information depending on Xano's response"
                }, null, 2)`
  },
  
  // Bulk update
  {
    find: 'emoji: "✏️ BULK UPDATE",\n                success: true,\n                data: result,\n                operation: "xano_bulk_update_records"',
    replace: `success: true,\n                data: result,\n                operation: "xano_bulk_update_records"`
  },
  
  // Update bulk update text
  {
    find: 'text: JSON.stringify({\n                success: true,\n                data: result,\n                operation: "xano_bulk_update_records"\n              }, null, 2)',
    replace: `text: (() => {
              const count = result.update_count || result.updated_records?.length || 0;
              const ids = result.updated_records?.join(', ') || 'N/A';
              return \`✏️ Bulk Update - \${count} record(s) modified | IDs: [\${ids}]\\n${separator}\\n\\n\` + JSON.stringify({
                success: true,
                data: result,
                operation: "xano_bulk_update_records"
              }, null, 2);
            })()`
  },
  
  // Hello tool
  {
    find: 'text: `Hello, ${name}!`',
    replace: `text: \`👋 Hello - \${name} | User ID: \${this.props?.userId || 'N/A'}\\n${separator}\\n\\nHello, \${name}!\``
  },
  
  // whoami tool
  {
    find: 'text: `Welcome, ${name}!\\nUser ID: ${this.props?.userId}\\nAuthenticated: ${!!this.props?.userId}`',
    replace: `text: \`👤 Current User - ID: \${this.props?.userId || 'N/A'} | Authenticated: \${!!this.props?.userId}\\n${separator}\\n\\nWelcome, \${name}!\\nUser ID: \${this.props?.userId}\\nAuthenticated: \${!!this.props?.userId}\``
  }
];

// Apply replacements
let changeCount = 0;
replacements.forEach(({ find, replace }, index) => {
  const before = content.length;
  content = content.replace(find, replace);
  if (content.length !== before) {
    changeCount++;
    console.log(`✅ Applied: ${find.substring(0, 60)}...`);
  } else {
    // Try with different whitespace
    const normalizedFind = find.replace(/\s+/g, '\\s+');
    const regex = new RegExp(normalizedFind);
    if (regex.test(content)) {
      content = content.replace(regex, replace);
      changeCount++;
      console.log(`✅ Applied (regex): ${find.substring(0, 60)}...`);
    }
  }
});

// Fix tools that return plain JSON.stringify(result)
const plainJsonTools = [
  { pattern: /"📦 API GROUPS\\\\n\\\\n" \+ JSON\.stringify\(result/g, replacement: '`🎯 API Groups - ${result.items?.length || 0} group(s) | Page ${result.curPage || 1}\\n' + separator + '\\n\\n` + JSON.stringify(result' },
  { pattern: /"📁 FILES LIST\\\\n\\\\n" \+ JSON\.stringify\(result/g, replacement: '`📁 Files - ${result.items?.length || 0} file(s) | Page ${result.curPage || 1}\\n' + separator + '\\n\\n` + JSON.stringify(result' },
  { pattern: /"🌿 BRANCHES\\\\n\\\\n" \+ JSON\.stringify\(result/g, replacement: '`🌿 Workspace Branches - ${result.length} branch(es) | Live: ${result.find(b => b.live)?.name || "main"}\\n' + separator + '\\n\\n` + JSON.stringify(result' },
  { pattern: /"📊 REQUEST HISTORY\\\\n\\\\n" \+ JSON\.stringify\(result/g, replacement: '`📊 Request History - ${result.items?.length || 0} request(s) | Page ${page}\\n' + separator + '\\n\\n` + JSON.stringify(result' }
];

plainJsonTools.forEach(({ pattern, replacement }) => {
  const before = content.length;
  content = content.replace(pattern, replacement);
  if (content.length !== before) {
    changeCount++;
    console.log(`✅ Applied pattern fix`);
  }
});

// Write back
fs.writeFileSync(filePath, content);
console.log(`\n✅ Ultimate format applied! Total changes: ${changeCount}`);