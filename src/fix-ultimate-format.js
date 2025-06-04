const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, 'index.ts');
let content = fs.readFileSync(filePath, 'utf8');

console.log('🔧 Applying ULTIMATE format fix to all tools...');

const separator = '='.repeat(50);

// Fix xano_list_instances
content = content.replace(
  /(text: )"🏢 XANO INSTANCES\\n\\n" \+ JSON\.stringify\({(\s*emoji: "🏢 XANO INSTANCES",)?(\s*instance_name:[^}]+}\), null, 2\)/g,
  (match, prefix, emoji, rest) => {
    return `${prefix}\`🏢 Xano Instances - \${result.length} instance(s) found\\n${separator}\\n\\n\` + JSON.stringify({ instances: result }, null, 2)`;
  }
);

// Fix xano_browse_api_groups
content = content.replace(
  /(text: )"📦 API GROUPS\\n\\n" \+ JSON\.stringify\(result, null, 2\)/g,
  (match, prefix) => {
    return `${prefix}((result: any) => {
              const page = result.curPage || 1;
              const items = result.items || [];
              const total = result.total || items.length;
              const perPage = result.perPage || 50;
              const totalPages = Math.ceil(total / perPage);
              return \`🎯 API Groups - \${items.length} group(s) | Page \${page}/\${totalPages}\\n${separator}\\n\\n\` + JSON.stringify({ page, per_page: perPage, api_groups: items, total }, null, 2);
            })(result)`;
  }
);

// Fix xano_get_api_group
content = content.replace(
  /(text: )"📦 API GROUP DETAILS\\n\\n" \+ JSON\.stringify\(result, null, 2\)/g,
  (match, prefix) => {
    return `${prefix}\`📁 API Group - "\${result.name || 'Unknown'}" | \${result.tag?.length || 0} tags | Swagger: \${result.swagger || false}\\n${separator}\\n\\n\` + JSON.stringify({ api_group: result }, null, 2)`;
  }
);

// Fix xano_browse_apis_in_group
content = content.replace(
  /(text: )"🔌 API LIST\\n\\n" \+ JSON\.stringify\(result, null, 2\)/g,
  (match, prefix) => {
    return `${prefix}((result: any) => {
              const page = result.curPage || 1;
              const items = result.items || [];
              const total = result.total || items.length;
              const perPage = result.perPage || 50;
              const totalPages = Math.ceil(total / perPage);
              return \`🔌 APIs in Group - \${items.length} API(s) | Page \${page}/\${totalPages}\\n${separator}\\n\\n\` + JSON.stringify({ page, per_page: perPage, apis: items, total }, null, 2);
            })(result)`;
  }
);

// Fix xano_list_files
content = content.replace(
  /(text: )"📁 FILES LIST\\n\\n" \+ JSON\.stringify\(result, null, 2\)/g,
  (match, prefix) => {
    return `${prefix}((result: any) => {
              const page = result.curPage || 1;
              const items = result.items || [];
              const total = result.total || items.length;
              const perPage = result.perPage || 50;
              const totalPages = Math.ceil(total / perPage);
              return \`📁 Files - \${items.length} file(s) | Page \${page}/\${totalPages}\\n${separator}\\n\\n\` + JSON.stringify({ page, per_page: perPage, files: items, total }, null, 2);
            })(result)`;
  }
);

// Fix xano_list_workspace_branches
content = content.replace(
  /(text: )"🌿 BRANCHES\\n\\n" \+ JSON\.stringify\(result, null, 2\)/g,
  (match, prefix) => {
    return `${prefix}((result: any) => {
              const liveBranch = result.find((b: any) => b.live)?.name || 'main';
              return \`🌿 Workspace Branches - \${result.length} branch(es) | Live: \${liveBranch}\\n${separator}\\n\\n\` + JSON.stringify({ branches: result }, null, 2);
            })(result)`;
  }
);

// Fix xano_browse_request_history
content = content.replace(
  /(text: )"📊 REQUEST HISTORY\\n\\n" \+ JSON\.stringify\(result, null, 2\)/g,
  (match, prefix) => {
    return `${prefix}((result: any, page: number = 1, per_page: number = 50) => {
              const items = result.items || result;
              const total = result.total || items.length;
              const totalPages = Math.ceil(total / per_page);
              return \`📊 Request History - \${items.length} request(s) | Page \${page}/\${totalPages}\\n${separator}\\n\\n\` + JSON.stringify({ page, per_page, requests: items, total }, null, 2);
            })(result, page, per_page)`;
  }
);

// Fix record operations with proper headers
content = content.replace(
  /(text: )"➕ RECORD CREATED\\n\\n" \+ JSON\.stringify\({(\s*success:[^}]+)}, null, 2\)/g,
  (match, prefix, jsonContent) => {
    return `${prefix}((data: any) => {
              const keyInfo = data.name || data.email || data.title || '';
              return \`➕ Record Created - ID: \${data.id || 'N/A'}\${keyInfo ? \` | \${keyInfo}\` : ''}\\n${separator}\\n\\n\` + JSON.stringify({ success: true, data, operation: "xano_create_table_record" }, null, 2);
            })(result)`;
  }
);

// Fix bulk operations
content = content.replace(
  /(text: )"✏️ BULK UPDATE\\n\\n" \+ JSON\.stringify\({(\s*success:[^}]+)}, null, 2\)/g,
  (match, prefix, jsonContent) => {
    return `${prefix}((data: any) => {
              const count = data.update_count || data.updated_records?.length || 0;
              const ids = data.updated_records?.join(', ') || 'N/A';
              return \`✏️ Bulk Update - \${count} record(s) modified | IDs: [\${ids}]\\n${separator}\\n\\n\` + JSON.stringify({ success: true, data, operation: "xano_bulk_update_records" }, null, 2);
            })(result)`;
  }
);

// Fix create operations with proper success messages
const createOperations = [
  { pattern: /"✅ TABLE CREATED"/, tool: 'xano_create_table', header: '📊 Table Created' },
  { pattern: /"➕ API GROUP CREATED"/, tool: 'xano_create_api_group', header: '✨ API Group Created' },
  { pattern: /"➕ API CREATED"/, tool: 'xano_create_api', header: '🚀 API Created' },
  { pattern: /"📤 FILE UPLOADED"/, tool: 'xano_upload_file', header: '📤 File Uploaded' }
];

createOperations.forEach(({ pattern, tool, header }) => {
  const regex = new RegExp(`(text: )${pattern.source}(\\s*\\+\\s*"[^"]*")?\\s*\\+\\s*JSON\\.stringify\\(`, 'g');
  content = content.replace(regex, (match, prefix) => {
    return `${prefix}\`${header} - ID: \${result.id || 'N/A'} | \${result.name ? \`Name: "\${result.name}"\` : 'Created successfully'}\\n${separator}\\n\\n\` + JSON.stringify(`;
  });
});

// Fix error responses
content = content.replace(
  /isError: true,\s*content: \[{\s*type: "text",\s*text: "❌ ERROR\\n\\n" \+ JSON\.stringify\(/g,
  `isError: true,
            content: [{
              type: "text",
              text: \`❌ Operation Failed - \${error.message || 'Unknown error'}\\n${separator}\\n\\n\` + JSON.stringify(`
);

// Fix simple greeting messages
content = content.replace(
  /(text: )"👋 GREETING\\n\\n" \+ `Hello, \$\{name\}!`/g,
  (match, prefix) => {
    return `${prefix}\`👋 Hello - \${name} | User ID: \${this.props?.userId || 'N/A'}\\n${separator}\\n\\nHello, \${name}!\``;
  }
);

content = content.replace(
  /(text: )"👤 USER PROFILE\\n\\n" \+ `Welcome, \$\{name\}!/g,
  (match, prefix) => {
    return `${prefix}\`👤 Current User - ID: \${this.props?.userId || 'N/A'} | Authenticated: \${!!this.props?.userId}\\n${separator}\\n\\nWelcome, \${name}!`;
  }
);

// Fix delete operations
const deletePatterns = [
  { pattern: /message: "🗑️ TABLE DELETED: " \+ "Table deleted successfully"/, replacement: `\`🗑️ Table Deleted - ID: \${table_id} | Workspace: \${workspace_id}\\n${separator}\\n\\n\` + JSON.stringify({ success: true, message: "Table deleted successfully", operation: "xano_delete_table" }, null, 2)` },
  { pattern: /message: `🗑️ RECORD DELETED: Record \$\{record_id\} deleted successfully`/, replacement: `\`🗑️ Record Deleted - ID: \${record_id} from Table \${table_id}\\n${separator}\\n\\n\` + JSON.stringify({ success: true, message: \`Record \${record_id} deleted successfully\` }, null, 2)` }
];

deletePatterns.forEach(({ pattern, replacement }) => {
  content = content.replace(new RegExp(pattern.source, 'g'), replacement);
});

// Write the updated file
fs.writeFileSync(filePath, content);
console.log('✅ ULTIMATE format fix applied!');
console.log('📋 Fixed:');
console.log('  - List operations with pagination');
console.log('  - Create operations with IDs');
console.log('  - Delete operations with context');
console.log('  - Error responses');
console.log('  - Greeting messages');