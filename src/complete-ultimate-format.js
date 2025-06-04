const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, 'index.ts');
let content = fs.readFileSync(filePath, 'utf8');

console.log('🚀 Completing ULTIMATE format for ALL tools...');

const separator = '='.repeat(50);

// Tools that need complete reformatting
const updates = [
  // Browse API groups
  {
    pattern: /JSON\.stringify\(result, null, 2\)\s*}\s*]\s*};\s*}\s*catch[^}]*xano_browse_api_groups/,
    search: 'text: JSON.stringify(result, null, 2)',
    context: 'xano_browse_api_groups',
    replace: `text: (() => {
              const page = result.curPage || 1;
              const items = result.items || [];
              const total = result.total || items.length;
              const perPage = result.perPage || 50;
              const totalPages = Math.ceil(total / perPage);
              return \`🎯 API Groups - \${items.length} group(s) | Page \${page}/\${totalPages}\\n${separator}\\n\\n\` + JSON.stringify(result, null, 2);
            })()`
  },
  
  // Get API group
  {
    search: 'text: JSON.stringify(result, null, 2)',
    context: 'xano_get_api_group',
    after: 'api_group: result',
    replace: `text: \`📁 API Group - "\${result.name || 'Unknown'}" | \${result.tag?.length || 0} tags | Swagger: \${result.swagger || false}\\n${separator}\\n\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // Browse APIs in group
  {
    search: 'text: JSON.stringify(result, null, 2)',
    context: 'xano_browse_apis_in_group',
    after: 'apis: result',
    replace: `text: (() => {
              const page = result.curPage || 1;
              const items = result.items || [];
              const total = result.total || items.length;
              const perPage = result.perPage || 50;
              const totalPages = Math.ceil(total / perPage);
              return \`🔌 APIs in Group - \${items.length} API(s) | Page \${page}/\${totalPages}\\n${separator}\\n\\n\` + JSON.stringify(result, null, 2);
            })()`
  },
  
  // List files
  {
    search: 'text: JSON.stringify(result, null, 2)',
    context: 'xano_list_files',
    after: 'files: result',
    replace: `text: (() => {
              const page = result.curPage || 1;
              const items = result.items || [];
              const total = result.total || items.length;
              const perPage = result.perPage || 50;
              const totalPages = Math.ceil(total / perPage);
              return \`📁 Files - \${items.length} file(s) | Page \${page}/\${totalPages}\\n${separator}\\n\\n\` + JSON.stringify(result, null, 2);
            })()`
  },
  
  // List workspace branches
  {
    search: 'text: JSON.stringify(result, null, 2)',
    context: 'xano_list_workspace_branches',
    after: 'branches: result',
    replace: `text: (() => {
              const liveBranch = result.find((b: any) => b.live)?.name || 'main';
              return \`🌿 Workspace Branches - \${result.length} branch(es) | Live: \${liveBranch}\\n${separator}\\n\\n\` + JSON.stringify(result, null, 2);
            })()`
  },
  
  // Browse request history
  {
    search: 'text: JSON.stringify(result, null, 2)',
    context: 'xano_browse_request_history',
    after: 'requests: result',
    replace: `text: (() => {
              const items = result.items || result;
              const total = result.total || items.length;
              const totalPages = Math.ceil(total / per_page);
              return \`📊 Request History - \${items.length} request(s) | Page \${page}/\${totalPages}\\n${separator}\\n\\n\` + JSON.stringify(result, null, 2);
            })()`
  },
  
  // Get API
  {
    search: 'text: JSON.stringify(result, null, 2)',
    context: 'xano_get_api"',
    after: 'api: result',
    replace: `text: \`🔌 API Details - "\${result.name || 'Unknown'}" | \${result.verb || 'GET'} \${result.path || '/'} | \${result.input?.length || 0} inputs\\n${separator}\\n\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // List databases
  {
    search: 'text: JSON.stringify({ instance_name: instance_name, databases: result }, null, 2)',
    replace: `text: \`💾 Xano Databases - \${result.length} workspace(s) found\\n${separator}\\n\\n\` + JSON.stringify({ instance_name: instance_name, databases: result }, null, 2)`
  },
  
  // Get instance details
  {
    search: 'text: JSON.stringify({ instance_name: instance_name, instance: result }, null, 2)',
    replace: `text: \`🏗️ Instance Details - "\${result.display || 'Unknown'}" | Rate limit: \${result.rate_limit || 'N/A'}\\n${separator}\\n\\n\` + JSON.stringify({ instance_name: instance_name, instance: result }, null, 2)`
  },
  
  // Get workspace details
  {
    search: 'text: JSON.stringify({ workspace_id: workspace_id, workspace: result }, null, 2)',
    replace: `text: \`🗂️ Workspace Details - "\${result.name || 'Unknown'}" | ID: \${result.id || workspace_id} | Branch: \${result.branch || 'main'}\\n${separator}\\n\\n\` + JSON.stringify({ workspace_id: workspace_id, workspace: result }, null, 2)`
  },
  
  // List tables
  {
    search: 'text: JSON.stringify({ workspace_id: database_id, tables: result }, null, 2)',
    replace: `text: (() => {
              const page = result.curPage || 1;
              const items = result.items || result;
              const total = result.total || items.length;
              const perPage = result.perPage || 50;
              const totalPages = Math.ceil(total / perPage);
              return \`📋 Tables - \${items.length} table(s) | Page \${page}/\${totalPages}\\n${separator}\\n\\n\` + JSON.stringify({ workspace_id: database_id, tables: result }, null, 2);
            })()`
  },
  
  // Get table details
  {
    search: 'text: JSON.stringify({\n                success: true,\n                data: result,\n                operation: "xano_get_table_details"\n              }, null, 2)',
    replace: `text: \`📋 Table Details - "\${result.name || 'Unknown'}" | ID: \${result.id || table_id} | Auth: \${result.auth || false}\\n${separator}\\n\\n\` + JSON.stringify({
                success: true,
                data: result,
                operation: "xano_get_table_details"
              }, null, 2)`
  },
  
  // Get table schema
  {
    search: 'text: JSON.stringify({\n                success: true,\n                data: result,\n                operation: "xano_get_table_schema"\n              }, null, 2)',
    replace: `text: \`🔧 Table Schema - \${result.schema?.length || 0} fields | Table: \${table_id}\\n${separator}\\n\\n\` + JSON.stringify({
                success: true,
                data: result,
                operation: "xano_get_table_schema"
              }, null, 2)`
  },
  
  // Browse table content
  {
    search: 'text: JSON.stringify({\n                page: page,\n                per_page: per_page,\n                records: result\n              }, null, 2)',
    replace: `text: (() => {
              const total = result.total || result.items?.length || 0;
              const totalPages = Math.ceil(total / per_page);
              return \`📋 Table Content - \${result.items?.length || 0} record(s) | Page \${page}/\${totalPages}\\n${separator}\\n\\n\` + JSON.stringify({
                page: page,
                per_page: per_page,
                records: result
              }, null, 2);
            })()`
  },
  
  // Get table record
  {
    search: 'text: JSON.stringify({\n                record_id: record_id,\n                record: result\n              }, null, 2)',
    replace: `text: \`📄 Record Details - ID: \${result.id || record_id} | Table: \${table_id}\\n${separator}\\n\\n\` + JSON.stringify({
                record_id: record_id,
                record: result
              }, null, 2)`
  },
  
  // Update table record
  {
    search: 'text: JSON.stringify({\n                success: true,\n                data: result,\n                operation: "xano_update_table_record"\n              }, null, 2)',
    replace: `text: \`✏️ Record Updated - ID: \${record_id} | \${Object.keys(record_data || {}).length} field(s) modified\\n${separator}\\n\\n\` + JSON.stringify({
                success: true,
                data: result,
                operation: "xano_update_table_record"
              }, null, 2)`
  },
  
  // Create table
  {
    search: 'text: JSON.stringify({\n                success: true,\n                message: "Table created successfully",\n                data: result,\n                operation: "xano_create_table"\n              }, null, 2)',
    replace: `text: \`📊 Table Created - ID: \${result.id || 'N/A'} | Workspace: \${workspace_id}\\n${separator}\\n\\n\` + JSON.stringify({
                success: true,
                message: "Table created successfully",
                data: result,
                operation: "xano_create_table"
              }, null, 2)`
  },
  
  // Update table
  {
    search: 'text: JSON.stringify({\n                success: true,\n                message: "Table updated successfully",\n                data: result,\n                operation: "xano_update_table"\n              }, null, 2)',
    replace: `text: \`✏️ Table Updated - ID: \${table_id} | Fields modified\\n${separator}\\n\\n\` + JSON.stringify({
                success: true,
                message: "Table updated successfully",
                data: result,
                operation: "xano_update_table"
              }, null, 2)`
  }
];

// Apply updates
let changeCount = 0;
updates.forEach(({ search, replace, context, after }) => {
  // Try exact match first
  if (content.includes(search)) {
    content = content.replace(search, replace);
    changeCount++;
    console.log(`✅ Updated: ${context || search.substring(0, 50)}...`);
  } else {
    // Try with flexible whitespace
    const normalizedSearch = search.replace(/\s+/g, '\\s+');
    const regex = new RegExp(normalizedSearch);
    if (regex.test(content)) {
      content = content.replace(regex, replace);
      changeCount++;
      console.log(`✅ Updated (regex): ${context || search.substring(0, 50)}...`);
    }
  }
});

// Write back
fs.writeFileSync(filePath, content);
console.log(`\n✅ Complete ultimate format applied! Total changes: ${changeCount}`);