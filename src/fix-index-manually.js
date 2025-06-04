const fs = require('fs');
const path = require('path');

// Read the broken index.ts
const indexPath = path.join(__dirname, 'index.ts');
let content = fs.readFileSync(indexPath, 'utf-8');

// Find and fix the misplaced enrichToolParams method
const badPattern = /\}\s*\n\s*\/\*\*\s*\n\s*\*\s*Enrich tool parameters[^}]+\}\s*as XanoAuthProps\);/s;
const match = content.match(badPattern);

if (match) {
  console.log('Found misplaced method, fixing...');
  
  // Extract just the method
  const methodPattern = /\/\*\*\s*\n\s*\*\s*Enrich tool parameters[^}]+\}/s;
  const methodMatch = match[0].match(methodPattern);
  const method = methodMatch[0];
  
  // Remove the bad placement
  content = content.replace(badPattern, '}\n');
  
  // Find the correct place to insert (after getSession method)
  const getSessionEnd = content.indexOf('return this.sessionManager;');
  const nextBrace = content.indexOf('}', getSessionEnd);
  
  // Insert the method in the correct place
  content = content.slice(0, nextBrace + 1) + '\n\n' + method + content.slice(nextBrace + 1);
}

// Write the fixed file
fs.writeFileSync(indexPath, content);
console.log('✅ Fixed index.ts!');