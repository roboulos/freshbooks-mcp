const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, 'index.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix emoji-in-JSON-key issues
const fixes = [
  // Fix record operations with emoji in JSON key
  {
    pattern: /text: JSON\.stringify\({\s*"([^"]+)":\s*true,\s*emoji:\s*"[^"]+",?\s*/g,
    replacement: 'text: "emoji" + ": " + JSON.stringify({\n                '
  },
  
  // Fix specific known issues
  {
    search: `              text: JSON.stringify({
                "➕ RECORD CREATED": true,
                emoji: "➕ RECORD CREATED",
                success: true,
                data: result,
                operation: "xano_create_table_record"
              })`,
    replace: `              text: "➕ RECORD CREATED\\n\\n" + JSON.stringify({
                success: true,
                data: result,
                operation: "xano_create_table_record"
              }, null, 2)`
  },
  
  // Fix bulk operations
  {
    pattern: /"✏️ BULK UPDATE":\s*true,\s*emoji:\s*"✏️ BULK UPDATE",/g,
    replacement: ''
  },
  
  // Add emojis to tools that lack them
  {
    search: 'text: JSON.stringify(result)',
    replaceAll: true,
    replacements: [
      { context: 'xano_browse_api_groups', emoji: '📦 API GROUPS' },
      { context: 'xano_get_api_group', emoji: '📦 API GROUP DETAILS' },
      { context: 'xano_browse_apis_in_group', emoji: '🔌 API LIST' },
      { context: 'xano_get_api', emoji: '🔌 API DETAILS' },
      { context: 'xano_list_files', emoji: '📁 FILES LIST' },
      { context: 'xano_list_workspace_branches', emoji: '🌿 BRANCHES' },
      { context: 'xano_browse_request_history', emoji: '📊 REQUEST HISTORY' },
      { context: 'xano_get_function_details', emoji: '⚡ FUNCTION DETAILS' },
      { context: 'xano_get_table_record', emoji: '📄 RECORD DETAILS' },
      { context: 'xano_upload_file', emoji: '📤 FILE UPLOADED' }
    ]
  }
];

// Fix emoji-in-key issues first
console.log('🔧 Fixing emoji-in-JSON-key issues...');

// Fix ➕ RECORD CREATED
content = content.replace(
  /text: JSON\.stringify\({\s*"➕ RECORD CREATED":\s*true,\s*emoji:\s*"➕ RECORD CREATED",/g,
  'text: "➕ RECORD CREATED\\n\\n" + JSON.stringify({\n                '
);

// Fix ✏️ BULK UPDATE  
content = content.replace(
  /text: JSON\.stringify\({\s*"✏️ BULK UPDATE":\s*true,\s*/g,
  'text: "✏️ BULK UPDATE\\n\\n" + JSON.stringify({\n                '
);

// Fix ➕ FIELD ADDED
content = content.replace(
  /"➕ FIELD ADDED":\s*true,\s*emoji:\s*"➕ FIELD ADDED",/g,
  ''
);

// Fix ✏️ FIELD RENAMED
content = content.replace(
  /"✏️ FIELD RENAMED":\s*true,\s*emoji:\s*"✏️ FIELD RENAMED",/g,
  ''
);

// Now let's add emojis to plain responses
console.log('🎨 Adding emojis to plain responses...');

// whoami
content = content.replace(
  /return {\s*content:\s*\[{\s*type:\s*"text",\s*text:\s*`Welcome,\s*\$\{name\}!/,
  'return {\n        content: [{\n          type: "text",\n          text: "👤 USER PROFILE\\n\\n" + `Welcome, ${name}!'
);

// hello
content = content.replace(
  /text:\s*`Hello,\s*\$\{name\}!`/,
  'text: "👋 GREETING\\n\\n" + `Hello, ${name}!`'
);

// Fix tools that return plain JSON.stringify(result)
const plainJsonTools = [
  { tool: 'xano_browse_api_groups', emoji: '📦 API GROUPS' },
  { tool: 'xano_get_api_group', emoji: '📦 API GROUP DETAILS' },
  { tool: 'xano_browse_apis_in_group', emoji: '🔌 API LIST' },
  { tool: 'xano_get_api', emoji: '🔌 API DETAILS' },
  { tool: 'xano_list_files', emoji: '📁 FILES LIST' },
  { tool: 'xano_list_workspace_branches', emoji: '🌿 BRANCHES' },
  { tool: 'xano_browse_request_history', emoji: '📊 REQUEST HISTORY' },
  { tool: 'xano_get_function_details', emoji: '⚡ FUNCTION DETAILS' },
  { tool: 'xano_get_table_record', emoji: '📄 RECORD DETAILS' },
  { tool: 'xano_create_search_index', emoji: '🔍 SEARCH INDEX CREATED' },
  { tool: 'xano_create_btree_index', emoji: '🔍 INDEX CREATED' },
  { tool: 'xano_list_tasks', emoji: '⏰ TASKS LIST' },
  { tool: 'xano_get_task_details', emoji: '⏰ TASK DETAILS' },
  { tool: 'xano_get_api_with_logic', emoji: '🔌 API LOGIC' },
  { tool: 'xano_get_table_with_script', emoji: '🏗️ TABLE SCHEMA' },
  { tool: 'xano_list_apis_with_logic', emoji: '🔌 API LIST' }
];

plainJsonTools.forEach(({ tool, emoji }) => {
  // Pattern to find the tool and its return statement
  const pattern = new RegExp(
    `(${tool}[\\s\\S]*?return\\s*{\\s*content:\\s*\\[{\\s*type:\\s*"text",\\s*text:\\s*)JSON\\.stringify\\(result\\)`,
    'g'
  );
  
  content = content.replace(pattern, `$1"${emoji}\\n\\n" + JSON.stringify(result, null, 2)`);
});

// Fix specific formatting issues
console.log('🎯 Standardizing response formats...');

// Fix responses that have emoji field but poor formatting
content = content.replace(
  /emoji:\s*"([^"]+)",\s*success:\s*true,/g,
  (match, emoji) => {
    return `success: true,\n                emoji_header: "${emoji}",`;
  }
);

// Write the updated file
fs.writeFileSync(filePath, content);
console.log('✅ Formatting fixes applied successfully!');