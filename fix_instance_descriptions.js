const fs = require('fs');
const path = require('path');

// Files to update
const filesToUpdate = [
  'src/index.ts',
  'src/my-mcp.ts',
  'src/xano-tools.ts',
  'src/xano-tools-implementation.ts',
  'src/index.ts.production',
  'src/index.ts.backup'
];

// Old and new descriptions
const oldDescription = 'instance_name: z.string().describe("The name of the Xano instance")';
const newDescription = 'instance_name: z.string().describe("The Xano instance domain (e.g., \'xivz-2uos-g8gq.n7.xano.io\' or \'api.clearleads.io\')")';

let totalReplacements = 0;

filesToUpdate.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;
  
  // Count replacements
  const matches = content.match(/instance_name: z\.string\(\)\.describe\("The name of the Xano instance"\)/g);
  const count = matches ? matches.length : 0;
  
  if (count > 0) {
    // Replace all occurrences
    content = content.replace(/instance_name: z\.string\(\)\.describe\("The name of the Xano instance"\)/g, newDescription);
    
    // Write back
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Updated ${filePath}: ${count} replacements`);
    totalReplacements += count;
  } else {
    console.log(`⏭️  No changes needed in ${filePath}`);
  }
});

console.log(`\n🎉 Total replacements: ${totalReplacements}`);
console.log('\n📝 Remember to:');
console.log('1. Update documentation to explain that full domains are required');
console.log('2. Test with different Xano instance domains');
console.log('3. Consider adding domain validation in getMetaApiUrl');