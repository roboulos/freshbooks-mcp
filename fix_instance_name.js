// Script to fix all tools missing instance_name parameter
// Find all tools that use getMetaApiUrl(instance_name) but don't have instance_name in schema

const fs = require('fs');

const content = fs.readFileSync('/Users/sboulos/cloudflare-mcp-server/src/index.ts', 'utf8');

// Find all lines with getMetaApiUrl(instance_name) that are NOT assigned to const metaApi
const lines = content.split('\n');
const brokenTools = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Find direct usage of getMetaApiUrl(instance_name) in template literals
  if (line.includes('${getMetaApiUrl(instance_name)}') && !line.includes('const metaApi')) {
    // Look backward to find the tool definition
    for (let j = i - 1; j >= Math.max(0, i - 30); j--) {
      if (lines[j].includes('this.server.tool(')) {
        const toolNameMatch = lines[j + 1].match(/"([^"]+)"/);
        if (toolNameMatch) {
          brokenTools.push({
            name: toolNameMatch[1],
            lineNumber: i + 1,
            toolDefLine: j + 1
          });
        }
        break;
      }
    }
  }
}

console.log('Broken tools found:');
brokenTools.forEach(tool => {
  console.log(`- ${tool.name} (line ${tool.lineNumber}, tool def at ${tool.toolDefLine})`);
});

console.log(`\nTotal broken tools: ${brokenTools.length}`);