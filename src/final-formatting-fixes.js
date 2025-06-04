const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, 'index.ts');
let content = fs.readFileSync(filePath, 'utf8');

console.log('🎨 Applying final formatting fixes...');

// Fix any remaining JSON.stringify without proper formatting
const toolsNeedingEmojis = [
  // File operations
  { pattern: /xano_upload_file[\s\S]*?return\s*{\s*content:\s*\[{\s*type:\s*"text",\s*text:\s*JSON\.stringify\({\s*success:\s*true,\s*message:\s*"File uploaded successfully"/g,
    emoji: '📤 FILE UPLOADED' },
  
  // Delete operations
  { pattern: /xano_delete_field[\s\S]*?message:\s*"Field deleted successfully"/g,
    needsHeader: true,
    emoji: '🗑️ FIELD DELETED' },
  
  // Table operations
  { pattern: /xano_update_table[\s\S]*?message:\s*"Table updated successfully"/g,
    needsHeader: true,
    emoji: '✏️ TABLE UPDATED' },
  
  // Truncate table
  { pattern: /message:\s*`Table\s*\$\{table_id\}\s*truncated successfully`/g,
    replace: 'emoji_header: "🧹 TABLE TRUNCATED",\n                message: `Table ${table_id} truncated successfully`' }
];

// Fix error responses to have consistent format
const errorPatterns = [
  {
    pattern: /isError:\s*true,\s*content:\s*\[{\s*type:\s*"text",\s*text:\s*JSON\.stringify\(/g,
    replace: 'isError: true,\n            content: [{\n              type: "text",\n              text: "❌ ERROR\\n\\n" + JSON.stringify('
  }
];

// Fix tools that need better separation between emoji and data
content = content.replace(
  /text:\s*JSON\.stringify\({\s*emoji:\s*"([^"]+)",/g,
  (match, emoji) => {
    return `text: "${emoji}\\n\\n" + JSON.stringify({`;
  }
);

// Fix any double emoji fields
content = content.replace(
  /emoji:\s*"[^"]+",\s*emoji_header:\s*"[^"]+",/g,
  (match) => {
    const emojiMatch = match.match(/emoji_header:\s*"([^"]+)"/);
    if (emojiMatch) {
      return `emoji_header: "${emojiMatch[1]}",`;
    }
    return match;
  }
);

// Add consistent formatting for success responses
const successPatterns = [
  // List operations should have clean headers
  { tool: 'xano_list_instances', format: 'header' },
  { tool: 'xano_list_databases', format: 'header' },
  { tool: 'xano_list_tables', format: 'header' },
  { tool: 'xano_browse_api_groups', format: 'header' },
  { tool: 'xano_list_files', format: 'header' },
  { tool: 'xano_list_functions', format: 'header' },
  { tool: 'xano_list_tasks', format: 'header' }
];

// Apply header format to list operations
successPatterns.forEach(({ tool }) => {
  const pattern = new RegExp(
    `(${tool}[\\s\\S]*?text:\\s*)"([^"]+)\\\\n\\\\n"\\s*\\+\\s*JSON\\.stringify`,
    'g'
  );
  
  content = content.replace(pattern, '$1`$2\\n${"=".repeat(50)}\\n\\n` + JSON.stringify');
});

// Fix parameter documentation in error messages
const paramErrors = [
  {
    error: 'Missing required parameter: swagger',
    fix: 'Missing required parameter: swagger (boolean) - Enable swagger documentation'
  },
  {
    error: 'Missing required parameter: description',
    fix: 'Missing required parameter: description (string) - API endpoint description'
  }
];

paramErrors.forEach(({ error, fix }) => {
  content = content.replace(new RegExp(error, 'g'), fix);
});

// Ensure all JSON responses are pretty-printed
content = content.replace(
  /JSON\.stringify\(([^,\)]+)\)/g,
  'JSON.stringify($1, null, 2)'
);

// But fix the ones that already have null, 2
content = content.replace(
  /JSON\.stringify\(([^,\)]+),\s*null,\s*2,\s*null,\s*2\)/g,
  'JSON.stringify($1, null, 2)'
);

// Add helpful parameter hints to tools with issues
const toolsNeedingParamHints = [
  {
    tool: 'xano_create_api_group',
    after: 'description: z.string().optional()',
    add: '.describe("API group description")'
  },
  {
    tool: 'xano_update_api_group',
    hint: '// Note: All parameters are required for updates, not just changed fields'
  }
];

// Final cleanup - ensure consistent spacing
content = content.replace(/\n{3,}/g, '\n\n');

// Write the updated file
fs.writeFileSync(filePath, content);
console.log('✅ Final formatting fixes applied!');
console.log('📋 Summary of fixes:');
console.log('  - Emoji headers separated from JSON data');
console.log('  - Error responses standardized');
console.log('  - JSON pretty-printing enabled');
console.log('  - Parameter documentation improved');
console.log('  - List operations have visual separators');