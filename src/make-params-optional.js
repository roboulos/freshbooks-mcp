const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.ts');
let content = fs.readFileSync(indexPath, 'utf-8');

console.log('🔧 Making instance_name and workspace_id optional in all tools...');

// Pattern to find instance_name declarations
const instancePatterns = [
  // Basic pattern
  /instance_name: z\.string\(\)\.describe\(/g,
  // With spaces
  /instance_name:\s+z\.string\(\)\s*\.describe\(/g
];

// Pattern to find workspace_id declarations  
const workspacePatterns = [
  // String type
  /workspace_id: z\.string\(\)\.describe\(/g,
  // Number type
  /workspace_id: z\.number\(\)\.describe\(/g,
  // Union type
  /workspace_id: z\.union\(\[z\.string\(\), z\.number\(\)\]\)\.describe\(/g,
  // With spaces
  /workspace_id:\s+z\.(string|number|union\([^)]+\))\(\)\s*\.describe\(/g
];

let modifications = 0;

// Make instance_name optional
instancePatterns.forEach(pattern => {
  const matches = content.match(pattern) || [];
  matches.forEach(match => {
    if (!match.includes('.optional()')) {
      const replacement = match.replace('z.string()', 'z.string().optional()');
      content = content.replace(match, replacement);
      modifications++;
    }
  });
});

// Make workspace_id optional
workspacePatterns.forEach(pattern => {
  const matches = content.match(pattern) || [];
  matches.forEach(match => {
    if (!match.includes('.optional()')) {
      const replacement = match.replace(/z\.(string|number|union\([^)]+\))\(\)/, 'z.$1().optional()');
      content = content.replace(match, replacement);
      modifications++;
    }
  });
});

// Write the result
fs.writeFileSync(indexPath, content);

console.log(`✅ Made ${modifications} parameters optional`);
console.log('📝 All instance_name and workspace_id parameters are now optional');