const fs = require('fs');

let content = fs.readFileSync('/Users/sboulos/cloudflare-mcp-server/src/index.ts', 'utf8');

// List of tools to fix (remaining ones)
const toolsToFix = [
  'xano_delete_api_group',
  'xano_browse_apis_in_group', 
  'xano_get_api',
  'xano_delete_api',
  'xano_export_workspace',
  'xano_export_workspace_schema',
  'xano_browse_request_history',
  'xano_truncate_table',
  'xano_delete_function',
  'xano_delete_task',
  'xano_publish_function',
  'xano_publish_task',
  'xano_activate_task'
];

// Function to add instance_name parameter to schema
function addInstanceNameToSchema(content, toolName) {
  const toolPattern = new RegExp(`(this\\.server\\.tool\\(\\s*"${toolName}",\\s*{)([^}]+)(}[^}]*async \\(\\{)([^}]+)(\\})`, 's');
  const match = content.match(toolPattern);
  
  if (match) {
    // Check if instance_name already exists
    if (match[2].includes('instance_name')) {
      console.log(`${toolName}: instance_name already exists in schema`);
      return content;
    }
    
    // Add instance_name to schema
    const newSchema = `instance_name: z.string().describe("The name of the Xano instance"),\n            ${match[2].trim()}`;
    
    // Add instance_name to function parameters
    const params = match[4].split(',').map(p => p.trim()).filter(p => p);
    if (!params.includes('instance_name')) {
      params.unshift('instance_name');
    }
    const newParams = params.join(', ');
    
    const replacement = `${match[1]}\n            ${newSchema}\n          ${match[3]}${newParams}${match[5]}`;
    
    console.log(`Fixing ${toolName}: Added instance_name to schema and parameters`);
    return content.replace(toolPattern, replacement);
  } else {
    console.log(`${toolName}: Pattern not found - may need manual fix`);
    return content;
  }
}

// Function to fix URL construction
function fixUrlConstruction(content) {
  // Replace direct getMetaApiUrl usage with const metaApi assignment
  const urlPattern = /const url = `\$\{getMetaApiUrl\(instance_name\)\}([^`]+)`;/g;
  
  return content.replace(urlPattern, (match, urlPart) => {
    return `const metaApi = getMetaApiUrl(instance_name);\n              const url = \`\${metaApi}${urlPart}\`;`;
  });
}

// Apply fixes
console.log('Starting fixes...\n');

for (const toolName of toolsToFix) {
  content = addInstanceNameToSchema(content, toolName);
}

console.log('\nFixing URL construction patterns...');
content = fixUrlConstruction(content);

// Write the fixed content
fs.writeFileSync('/Users/sboulos/cloudflare-mcp-server/src/index.ts', content);

console.log('\nAll fixes applied successfully!');
console.log('The file has been updated with instance_name parameters and proper URL construction.');