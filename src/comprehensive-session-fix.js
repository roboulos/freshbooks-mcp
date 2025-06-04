const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.ts');
let content = fs.readFileSync(indexPath, 'utf-8');

console.log('🔧 Applying comprehensive session fixes to all tools...\n');

// Tools that need session support
const toolsToFix = [
  'xano_list_tasks',
  'xano_browse_api_groups', 
  'xano_get_table_details',
  'xano_get_table_schema',
  'xano_create_table',
  'xano_add_field_to_schema',
  'xano_create_table_record'
];

// Template for session resolution code
const sessionResolutionTemplate = `

        // Get session defaults if parameters not provided
        const session = await this.getSession();
        if (!instance_name) {
          try {
            instance_name = session.getInstanceName();
          } catch (error) {
            return error.toMCPResponse ? error.toMCPResponse() : {
              content: [{ type: "text", text: error.message }]
            };
          }
        }
        if (!workspace_id && workspace_id !== 0) {
          try {
            workspace_id = session.getWorkspaceId();
          } catch (error) {
            return error.toMCPResponse ? error.toMCPResponse() : {
              content: [{ type: "text", text: error.message }]
            };
          }
        }
`;

let fixedCount = 0;

toolsToFix.forEach(toolName => {
  console.log(`🔍 Looking for ${toolName}...`);
  
  // Find the tool definition
  const toolRegex = new RegExp(`"${toolName}",[\\s\\S]*?async \\(\\{([^}]+)\\}\\) => \\{`, 'g');
  const match = toolRegex.exec(content);
  
  if (match) {
    const handlerStart = match.index + match[0].length;
    
    // Check if session resolution already exists
    if (content.substring(handlerStart, handlerStart + 200).includes('getSession')) {
      console.log(`  ✓ Already has session support`);
      return;
    }
    
    // Find where to insert (after authentication check)
    const authCheckIndex = content.indexOf('Authentication required', handlerStart);
    if (authCheckIndex === -1) {
      console.log(`  ⚠️ No auth check found, skipping`);
      return;
    }
    
    const insertPoint = content.indexOf('}', authCheckIndex) + 1;
    
    // Insert session resolution
    content = content.slice(0, insertPoint) + sessionResolutionTemplate + content.slice(insertPoint);
    fixedCount++;
    console.log(`  ✅ Added session support`);
  } else {
    console.log(`  ❌ Tool not found`);
  }
});

// Special fix for xano_create_table_record - also needs natural language table support
console.log(`\n🔍 Adding natural language support to xano_create_table_record...`);

const createRecordPattern = /"xano_create_table_record",[\s\S]*?table_id: z\.union/;
const createRecordMatch = content.match(createRecordPattern);

if (createRecordMatch) {
  // Add table parameter
  const oldSchema = 'table_id: z.union([z.string(), z.number()]).describe("The ID of the table")';
  const newSchema = `table_id: z.union([z.string(), z.number()]).optional().describe("The ID of the table"),
        table: z.string().optional().describe("Table name (alternative to table_id)")`;
  
  content = content.replace(oldSchema, newSchema);
  
  // Update the parameter list
  content = content.replace(
    'async ({ instance_name, workspace_id, table_id, record_data })',
    'async ({ instance_name, workspace_id, table_id, table, record_data })'
  );
  
  console.log(`  ✅ Added table name parameter`);
}

// Write the fixed content
fs.writeFileSync(indexPath, content);

console.log(`\n✅ Fixed ${fixedCount} tools with session support`);
console.log('📝 All critical tools should now work with session context');
console.log('\n🚀 Ready to deploy the fixes!');