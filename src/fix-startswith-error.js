const fs = require('fs');
const path = require('path');

// Read utils.ts
const utilsPath = path.join(__dirname, 'utils.ts');
let content = fs.readFileSync(utilsPath, 'utf-8');

console.log('🔧 Fixing startsWith error in getMetaApiUrl...');

// Find and fix the getMetaApiUrl function
const oldFunction = `export function getMetaApiUrl(instanceName: string): string {
  // If it's already a full URL, just append the API path
  if (instanceName.startsWith("http://") || instanceName.startsWith("https://")) {`;

const newFunction = `export function getMetaApiUrl(instanceName: string): string {
  // Guard against undefined/null
  if (!instanceName) {
    throw new Error(
      "Instance name is required. " +
      "Use xano_set_context to set a default instance or provide instance_name parameter."
    );
  }
  
  // If it's already a full URL, just append the API path
  if (instanceName.startsWith("http://") || instanceName.startsWith("https://")) {`;

content = content.replace(oldFunction, newFunction);

// Write the fixed file
fs.writeFileSync(utilsPath, content);

console.log('✅ Fixed getMetaApiUrl to handle undefined instanceName');
console.log('📝 Added helpful error message for missing instance');

// Now fix a critical tool that's not using session properly
const indexPath = path.join(__dirname, 'index.ts');
let indexContent = fs.readFileSync(indexPath, 'utf-8');

// Find xano_list_functions and fix it
console.log('\n🔧 Fixing xano_list_functions to use session defaults...');

// Find the tool handler
const toolPattern = /"xano_list_functions",[\s\S]*?async \(\{([^}]+)\}\) => \{/;
const match = indexContent.match(toolPattern);

if (match) {
  const params = match[1];
  const handlerStart = match.index + match[0].length;
  
  // Find where authentication check ends
  const authCheckEnd = indexContent.indexOf('}', indexContent.indexOf('Authentication required', handlerStart)) + 1;
  
  // Add session default resolution
  const sessionCode = `

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
  
  indexContent = indexContent.slice(0, authCheckEnd) + sessionCode + indexContent.slice(authCheckEnd);
  console.log('✅ Added session default resolution to xano_list_functions');
}

// Write the fixed index
fs.writeFileSync(indexPath, indexContent);

console.log('\n🚀 Fixes applied! Ready to deploy.');