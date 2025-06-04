const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, 'index.ts');
let content = fs.readFileSync(filePath, 'utf8');

console.log('🔍 Finding and updating missing tools...');

const separator = '='.repeat(50);

// Define the missing tools
const missingTools = [
  // Debug tools
  {
    tool: 'debug_auth',
    format: () => `🔐 Auth Debug - Current authentication status\n${separator}\n\n`
  },
  {
    tool: 'debug_refresh_profile',
    format: () => `🔄 Profile Refreshed - User data updated\n${separator}\n\n`
  },
  {
    tool: 'debug_kv_storage',
    format: (data) => `🔑 KV Storage Debug - ${data.keyCount || 0} key(s) found\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'debug_session_info',
    format: (data) => `📊 Session Info - Active: ${data.success ? 'Yes' : 'No'}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  },
  {
    tool: 'debug_test_session_control',
    format: (data, params) => `🔧 Session Control - Action: ${params.action} | Session: ${params.sessionId}\n${separator}\n\n${JSON.stringify(data, null, 2)}`
  }
];

// Check each tool
missingTools.forEach(({ tool, format }) => {
  // Check if tool exists
  const toolRegex = new RegExp(`async ${tool}\\(`);
  if (content.match(toolRegex)) {
    console.log(`✅ Found ${tool}, updating format...`);
    
    // Update the format
    const updatePattern = new RegExp(
      `(async ${tool}\\([^)]*\\)[\\s\\S]*?return\\s*{[\\s\\S]*?content:\\s*\\[{[\\s\\S]*?text:\\s*)([\\s\\S]*?)(?=\\s*}\\s*]\\s*})`,
      'g'
    );
    
    content = content.replace(updatePattern, (match, prefix, currentText) => {
      const needsParams = format.toString().includes('params');
      
      let newText;
      if (currentText.includes('JSON.stringify')) {
        const responseMatch = currentText.match(/JSON\.stringify\(([\s\S]+?)\)(?:\s*,\s*null,\s*2)?/);
        if (responseMatch) {
          if (needsParams) {
            const funcMatch = match.match(/async\s+\w+\(([^)]+)\)/);
            const paramName = funcMatch?.[1]?.trim() || 'params';
            
            newText = `((data: any) => {
                const formatFn = ${format.toString()};
                return formatFn(data, ${paramName});
              })(${responseMatch[1]}) + JSON.stringify(${responseMatch[1]}, null, 2)`;
          } else {
            newText = `((data: any) => {
                const formatFn = ${format.toString()};
                return formatFn(data);
              })(${responseMatch[1]}) + JSON.stringify(${responseMatch[1]}, null, 2)`;
          }
        } else {
          newText = `"${format().split('\\n')[0]}\\n${separator}\\n\\n" + ${currentText}`;
        }
      } else {
        // For simple text responses
        newText = `"${format().split('\\n')[0]}\\n${separator}\\n\\n" + ${currentText}`;
      }
      
      return prefix + newText;
    });
  }
});

// Also check for XanoScript helper tools that might need formatting
const xanoScriptTools = [
  'xano_get_function_template',
  'xano_get_block_template', 
  'xano_get_started',
  'xano_validate_line'
];

xanoScriptTools.forEach(tool => {
  const toolRegex = new RegExp(`case '${tool}':`);
  if (content.match(toolRegex)) {
    console.log(`✅ Found XanoScript tool: ${tool}`);
  }
});

// Write the updated file
fs.writeFileSync(filePath, content);
console.log('✅ Missing tools update complete!');