const fs = require('fs');
const path = require('path');

/**
 * Script to fix session management in index.ts
 * Makes instance_name and workspace_id optional and adds session injection
 */

const indexPath = path.join(__dirname, 'index.ts');
let content = fs.readFileSync(indexPath, 'utf-8');

console.log('🔧 Applying session management fixes...');

// Step 1: Add session-aware wrapper import
const importIndex = content.indexOf('import { SmartError } from ');
if (importIndex > -1) {
  const nextNewline = content.indexOf('\n', importIndex);
  const sessionImport = `
import { SessionAwareToolWrapper, createSessionAwareTool } from './session-aware-wrapper';`;
  content = content.slice(0, nextNewline) + sessionImport + content.slice(nextNewline);
}

// Step 2: Find all tool definitions and make parameters optional
const toolPattern = /this\.server\.tool\(\s*"([^"]+)"\s*,\s*\{([^}]+)\}/g;
let matches;
let modifications = 0;

// Process each tool definition
while ((matches = toolPattern.exec(content)) !== null) {
  const toolName = matches[1];
  const schemaContent = matches[2];
  
  // Check if this tool has instance_name or workspace_id
  if (schemaContent.includes('instance_name:') || schemaContent.includes('workspace_id:')) {
    console.log(`  📝 Processing tool: ${toolName}`);
    
    // Make instance_name optional
    if (schemaContent.includes('instance_name:') && !schemaContent.includes('instance_name: z.string().optional()')) {
      const instancePattern = /instance_name:\s*z\.string\(\)\.describe\(([^)]+)\)/;
      const replacement = 'instance_name: z.string().optional().describe($1)';
      content = content.replace(instancePattern, replacement);
      modifications++;
    }
    
    // Make workspace_id optional
    if (schemaContent.includes('workspace_id:') && !schemaContent.includes('.optional()')) {
      const workspacePattern = /workspace_id:\s*z\.(string|number|union[^)]+)\(\)\.describe\(([^)]+)\)/;
      const replacement = 'workspace_id: z.$1().optional().describe($2)';
      content = content.replace(workspacePattern, replacement);
      modifications++;
    }
  }
}

// Step 3: Add session parameter injection to each tool handler
// This is more complex - we need to wrap each handler function
const toolHandlerPattern = /async\s*\(\s*\{([^}]+)\}\s*\)\s*=>\s*\{/g;

// First, let's add a helper method to the class
const classStart = content.indexOf('export class MyMCP');
const getSessionEnd = content.indexOf('}', content.indexOf('getSession():'));

if (getSessionEnd > -1) {
  const enrichParamsMethod = `

  /**
   * Enrich tool parameters with session defaults
   */
  private async enrichToolParams(params: any): Promise<any> {
    const session = await this.getSession();
    return session.enrichParams(params);
  }`;
  
  content = content.slice(0, getSessionEnd + 1) + enrichParamsMethod + content.slice(getSessionEnd + 1);
}

// Step 4: Modify tool handlers to use enriched params
// This is complex, so we'll create a targeted fix for key tools

// Target specific high-use tools
const criticalTools = [
  'xano_list_tables',
  'xano_browse_table_content', 
  'xano_get_table_schema',
  'xano_create_table_record',
  'xano_update_table_record',
  'xano_browse_api_groups',
  'xano_browse_apis_in_group'
];

criticalTools.forEach(toolName => {
  console.log(`  🔄 Adding session injection to: ${toolName}`);
  
  // Find the tool definition
  const toolRegex = new RegExp(`this\\.server\\.tool\\(\\s*"${toolName}"[^{]+\\{[^}]+\\}\\s*,\\s*async\\s*\\(([^)]+)\\)\\s*=>\\s*\\{`, 'g');
  const match = toolRegex.exec(content);
  
  if (match) {
    const paramsVar = match[1];
    const handlerStart = match.index + match[0].length;
    
    // Add parameter enrichment at the start of the handler
    const enrichmentCode = `
        // Enrich parameters with session defaults
        const enrichedParams = await this.enrichToolParams(${paramsVar});
        const { instance_name = enrichedParams.instance_name, workspace_id = enrichedParams.workspace_id, ...otherParams } = enrichedParams;
`;
    
    content = content.slice(0, handlerStart) + enrichmentCode + content.slice(handlerStart);
  }
});

// Step 5: Write the modified file
const outputPath = path.join(__dirname, 'index-session-fixed.ts');
fs.writeFileSync(outputPath, content);

console.log(`\n✅ Session management fixes applied!`);
console.log(`📄 Output written to: ${outputPath}`);
console.log(`\n📊 Summary:`);
console.log(`  - Made ${modifications} parameters optional`);
console.log(`  - Added session injection to ${criticalTools.length} critical tools`);
console.log(`\n🚀 Next steps:`);
console.log(`  1. Review the changes in index-session-fixed.ts`);
console.log(`  2. Test with: npm test session-elimination.test.ts`);
console.log(`  3. Replace index.ts with the fixed version`);
console.log(`  4. Deploy with: wrangler deploy`);