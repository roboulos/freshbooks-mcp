const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, 'index.ts');
let content = fs.readFileSync(filePath, 'utf8');

console.log('🔧 Fixing ALL tools to use Ultimate Format...\n');

const separator = '='.repeat(50);

// Comprehensive list of format fixes
const formatFixes = [
  // xano_list_databases - Line 560
  {
    pattern: /text: "💾 Xano Databases:\\n" \+ JSON\.stringify\({ databases: result }, null, 2\)/,
    replacement: `text: \`💾 Xano Databases - \${result.length} workspace(s) found\\n\${"=".repeat(50)}\\n\` + JSON.stringify({ databases: result }, null, 2)`
  },
  
  // xano_get_instance_details - Need to find and fix
  {
    pattern: /text: "🏗️ Instance Details:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`🏗️ Instance Details - "\${result.display}" | Rate limit: \${result.rate_limit}\\n\${"=".repeat(50)}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_list_tables - Need to fix the count
  {
    pattern: /text: `📋 Tables in Workspace \${database_id}:\\n` \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`📋 Tables - \${result.tables?.items?.length || 0} table(s) | Page \${result.tables?.curPage || 1}/\${result.tables?.totPage || 1}\\n\${"=".repeat(50)}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_browse_table_content
  {
    pattern: /text: `📊 Table Content \(\${table[^}]*}[^)]*\):\\n` \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`📋 Table Content - \${result.data?.items?.length || 0} record(s) | Page \${page}/\${Math.ceil((result.data?.totItems || 0) / per_page)}\\n\${"=".repeat(50)}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_auth_me
  {
    pattern: /text: "🔐 User Authentication Info:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`🔐 Authentication - User: "\${result.name}" | ID: \${result.id} | Email: \${result.email}\\n\${"=".repeat(50)}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_list_functions - Missing format entirely
  {
    pattern: /text: `⚡ Functions - \${result\.data\.items\.length} function\(s\)` \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`⚡ Functions - \${result.data.items.length} function(s) | Page \${result.data.curPage}/\${result.data.totPage}\\n\${"=".repeat(50)}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_create_table - Fix undefined workspace_id
  {
    pattern: /text: `📊 Table Created - ID: \${result\.id} \| Workspace: \${result\.workspace_id}\\n\${"=".repeat\(50\)}\\n`/,
    replacement: `text: \`📊 Table Created - ID: \${result.id} | Workspace: \${workspace_id}\\n\${"=".repeat(50)}\\n\``
  },
  
  // xano_update_table - Add proper error format
  {
    pattern: /text: `Error: \${result\.error}`/g,
    replacement: `text: \`❌ Tool Failed - \${result.error}\\n\${"=".repeat(50)}\\n\${result.error}\``
  },
  
  // xano_delete_table success message
  {
    pattern: /message: "Table deleted successfully"/,
    replacement: `message: \`🗑️ Table Deleted - ID: \${table_id} | Workspace: \${workspace_id}\\n\${"=".repeat(50)}\\nTable deleted successfully\``
  },
  
  // Fix all generic error messages
  {
    pattern: /text: `Error: \${error\.message}`/g,
    replacement: `text: \`❌ Tool Failed - \${error.message}\\n\${"=".repeat(50)}\\n\${error.message}\``
  },
  
  // Fix error messages with specific context
  {
    pattern: /text: `Error ([^:]+): \${([^}]+)}`/g,
    replacement: `text: \`❌ $1 Failed - \${$2}\\n\${"=".repeat(50)}\\n\${$2}\``
  },
  
  // xano_list_tasks
  {
    pattern: /text: `⏰ Tasks - \${result\.data\.items\.length} task\(s\)` \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`⏰ Tasks - \${result.data.items.length} task(s) | Page \${result.data.curPage}/\${result.data.totPage}\\n\${"=".repeat(50)}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_get_task_details
  {
    pattern: /text: `⏰ Task Details - "\${result\.name}"[^`]*` \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`⏰ Task Details - "\${result.name}" | ID: \${result.id} | Active: \${result.active === null || result.active === undefined ? 'N/A' : String(result.active)} | Draft: \${result._draft_last_update ? 'Yes' : 'No'}\\n\${"=".repeat(50)}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_get_function_details
  {
    pattern: /text: `⚡ Function Details - "\${result\.name}"[^`]*` \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`⚡ Function Details - "\${result.name}" | ID: \${result.id} | Draft: \${result._draft_last_update ? 'Yes' : 'No'}\\n\${"=".repeat(50)}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_get_table_record
  {
    pattern: /text: "📄 Record Details:\\n" \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`📄 Record Details - ID: \${result.id} | \${result.email || result.name || ''}\\n\${"=".repeat(50)}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_create_table_record
  {
    pattern: /message: "➕ RECORD CREATED: " \+ JSON\.stringify\(result\)/,
    replacement: `message: \`➕ Record Created - ID: \${result.data?.id || result.id} | \${result.data?.email || result.data?.name || ''}\\n\${"=".repeat(50)}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_bulk_create_records
  {
    pattern: /message: `Successfully created \${result\.success_total} records`/,
    replacement: `message: \`➕ Bulk Create - \${result.success_total} record(s) created | IDs: [\${result.data?.slice(0, 5).join(', ')}\${result.data?.length > 5 ? '...' : ''}]\\n\${"=".repeat(50)}\\nSuccessfully created \${result.success_total} records\``
  },
  
  // xano_bulk_update_records
  {
    pattern: /message: `Successfully updated \${result\.success_total} records`/,
    replacement: `message: \`✏️ Bulk Update - \${result.success_total} record(s) modified\\n\${"=".repeat(50)}\\nSuccessfully updated \${result.success_total} records\``
  },
  
  // Fix authentication required messages
  {
    pattern: /text: "Authentication required to use this tool\."/g,
    replacement: `text: "🔒 Authentication required to use this tool."`
  },
  
  // Fix API key not available messages
  {
    pattern: /text: "API key not available\. Please ensure you are authenticated\."/g,
    replacement: `text: "🔑 API key not available. Please ensure you are authenticated."`
  },
  
  // xano_browse_api_groups - Fix function that returns string
  {
    pattern: /return `🎯 API Groups - \${items\.length} group\(s\) \| Page \${page}\/\${totalPages}\\n\\$\{"=".repeat\(50\)\}\\n\\n` \+ JSON\.stringify\(result, null, 2\);/,
    replacement: `return \`🎯 API Groups - \${items.length} group(s) | Page \${page}/\${totalPages}\\n\${"=".repeat(50)}\\n\\n\` + JSON.stringify(result, null, 2);`
  },
  
  // xano_browse_apis_in_group - Fix function that returns string
  {
    pattern: /return `🔌 APIs in Group - \${items\.length} API\(s\) \| Page \${page}\/\${totalPages}\\n\\$\{"=".repeat\(50\)\}\\n\\n` \+ JSON\.stringify\(result, null, 2\);/,
    replacement: `return \`🔌 APIs in Group - \${items.length} API(s) | Page \${page}/\${totalPages}\\n\${"=".repeat(50)}\\n\\n\` + JSON.stringify(result, null, 2);`
  },
  
  // Fix xano_upload_file
  {
    pattern: /message: `📤 File Uploaded - "\${result\.name}" \| Size: \${result\.size} bytes \| ID: \${result\.id}\\n\$\{"=".repeat\(50\)\}\\n` \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `message: \`📤 File Uploaded - "\${result.name}" | Size: \${result.size} bytes | ID: \${result.id}\\n\${"=".repeat(50)}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_list_files
  {
    pattern: /text: `📁 Files - \${result\.items\.length} file\(s\) \| Page \${result\.curPage}\/\${result\.totPage}\\n\$\{"=".repeat\(50\)\}\\n` \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`📁 Files - \${result.items.length} file(s) | Page \${result.curPage}/\${result.totPage}\\n\${"=".repeat(50)}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_list_workspace_branches
  {
    pattern: /text: `🌿 Workspace Branches - \${result\.length} branch\(es\) \| Live: \${liveBranch}\\n\$\{"=".repeat\(50\)\}\\n` \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`🌿 Workspace Branches - \${result.length} branch(es) | Live: \${liveBranch}\\n\${"=".repeat(50)}\\n\` + JSON.stringify(result, null, 2)`
  },
  
  // xano_browse_request_history
  {
    pattern: /text: `📊 Request History - \${result\.items\.length} request\(s\) \| Page \${result\.curPage}\/\${result\.totPage}\\n\$\{"=".repeat\(50\)\}\\n` \+ JSON\.stringify\(result, null, 2\)/,
    replacement: `text: \`📊 Request History - \${result.items.length} request(s) | Page \${result.curPage}/\${result.totPage}\\n\${"=".repeat(50)}\\n\` + JSON.stringify(result, null, 2)`
  }
];

// Apply all fixes
let fixCount = 0;
formatFixes.forEach((fix, index) => {
  const before = content.length;
  content = content.replace(fix.pattern, fix.replacement);
  if (content.length !== before) {
    fixCount++;
    console.log(`✅ Applied fix ${index + 1}: ${fix.pattern.source ? fix.pattern.source.substring(0, 50) : fix.pattern.toString().substring(0, 50)}...`);
  }
});

// Special case: Fix the browse_api_groups title issue (it's showing Request History instead)
const browseApiGroupsFix = /📊 Request History/g;
let matches = content.match(browseApiGroupsFix);
if (matches) {
  console.log(`\n🔍 Found ${matches.length} instances of incorrect "Request History" title`);
  // Only replace in the context of browse_api_groups
  content = content.replace(
    /(browse_api_groups[^}]*?})([^}]*?)📊 Request History/g,
    '$1$2🎯 API Groups'
  );
}

// Write the updated content
fs.writeFileSync(filePath, content);

console.log(`\n✅ Fixed ${fixCount} format issues!`);
console.log('\n📝 Summary of fixes:');
console.log('  - Added missing separators');
console.log('  - Fixed metric calculations');
console.log('  - Standardized error formatting');
console.log('  - Added authentication emojis');
console.log('  - Fixed undefined/null handling');
console.log('  - Corrected tool titles');