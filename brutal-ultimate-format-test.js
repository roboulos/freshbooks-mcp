#!/usr/bin/env node

/**
 * BRUTAL ULTIMATE FORMAT COMPLIANCE TEST
 * This test will EXPOSE any lies about Ultimate Format compliance
 * and show the EXACT truth about every single tool's compliance status.
 */

const fs = require('fs');

console.log('🔥 BRUTAL ULTIMATE FORMAT COMPLIANCE TEST - NO MERCY\n');

try {
  const indexContent = fs.readFileSync('/Users/sboulos/cloudflare-mcp-server/src/index.ts', 'utf8');
  
  // Extract ALL tool definitions with their responses
  const toolPattern = /this\.server\.tool\(\s*"([^"]+)"/g;
  const tools = [];
  let match;
  
  while ((match = toolPattern.exec(indexContent)) !== null) {
    tools.push(match[1]);
  }
  
  console.log(`📊 FOUND ${tools.length} TOTAL TOOLS\n`);
  
  if (tools.length !== 76) {
    console.log(`❌ LIAR! Expected 76 tools but found ${tools.length}`);
    process.exit(1);
  }
  
  // For each tool, find its response patterns and validate Ultimate Format
  const results = {
    compliant: [],
    nonCompliant: [],
    authOnly: [],
    errors: []
  };
  
  tools.forEach(toolName => {
    console.log(`\n🔍 ANALYZING TOOL: ${toolName}`);
    
    // Find the tool's implementation
    const toolRegex = new RegExp(`this\\.server\\.tool\\(\\s*"${toolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*?(?=this\\.server\\.tool\\(|$)`, 'g');
    const toolMatch = toolRegex.exec(indexContent);
    
    if (!toolMatch) {
      console.log(`   ❌ TOOL NOT FOUND IN CODE`);
      results.errors.push(toolName);
      return;
    }
    
    const toolCode = toolMatch[0];
    
    // Look for ALL response patterns in this tool
    const responsePatterns = [
      // Ultimate Format pattern: emoji + description + separator + JSON
      /text:\s*`([🔥🏢💾🗂️📋📊🔧🆕🔄🗑️➕✏️❌📝📄🚀⚡🧠🔍🔐👋🎯📁📤🌿📂🆕📦📈▶️⏸️🏗️]+[^`]*)\$\{"=".repeat\(50\)\}\\n`\s*\+\s*JSON\.stringify/g,
      // Non-Ultimate Format: plain JSON.stringify without Ultimate Format
      /text:\s*JSON\.stringify\(/g,
      // Authentication-only responses
      /text:\s*"🔐 Authentication Required - Access denied\\n==================================================\\nAuthentication required to use this tool\."/g
    ];
    
    let hasUltimateFormat = false;
    let hasPlainJson = false;
    let hasAuthOnly = false;
    let responseCount = 0;
    
    // Check Ultimate Format pattern
    const ultimateMatches = [...toolCode.matchAll(responsePatterns[0])];
    if (ultimateMatches.length > 0) {
      hasUltimateFormat = true;
      responseCount += ultimateMatches.length;
      console.log(`   ✅ ULTIMATE FORMAT RESPONSES: ${ultimateMatches.length}`);
      ultimateMatches.forEach((match, i) => {
        const header = match[1];
        console.log(`      Response ${i+1}: "${header.substring(0, 60)}..."`);
      });
    }
    
    // Check for plain JSON.stringify (BAD)
    const plainJsonMatches = [...toolCode.matchAll(responsePatterns[1])];
    if (plainJsonMatches.length > 0) {
      hasPlainJson = true;
      responseCount += plainJsonMatches.length;
      console.log(`   ❌ PLAIN JSON RESPONSES (NON-COMPLIANT): ${plainJsonMatches.length}`);
    }
    
    // Check auth-only responses
    const authMatches = [...toolCode.matchAll(responsePatterns[2])];
    if (authMatches.length > 0) {
      hasAuthOnly = true;
      responseCount += authMatches.length;
      console.log(`   🔐 AUTH-ONLY RESPONSES: ${authMatches.length}`);
    }
    
    // Additional patterns to catch
    const additionalChecks = [
      // Old-style auth messages
      /text:\s*"Authentication required to use this tool\."/g,
      // Error responses without Ultimate Format
      /text:\s*`Error[^`]*`/g,
      // Plain string responses
      /text:\s*"[^"]*"/g
    ];
    
    additionalChecks.forEach((pattern, index) => {
      const matches = [...toolCode.matchAll(pattern)];
      if (matches.length > 0) {
        console.log(`   ⚠️  ADDITIONAL PATTERN ${index + 1}: ${matches.length} matches`);
        responseCount += matches.length;
        if (index === 0) hasPlainJson = true; // Old auth is non-compliant
      }
    });
    
    console.log(`   📈 TOTAL RESPONSES FOUND: ${responseCount}`);
    
    // Determine compliance status
    if (responseCount === 0) {
      console.log(`   ⚠️  NO RESPONSES FOUND - UNUSUAL`);
      results.errors.push(toolName);
    } else if (hasPlainJson && !hasUltimateFormat) {
      console.log(`   ❌ NON-COMPLIANT: Only plain JSON, no Ultimate Format`);
      results.nonCompliant.push(toolName);
    } else if (hasUltimateFormat && !hasPlainJson) {
      console.log(`   ✅ FULLY COMPLIANT: Ultimate Format only`);
      results.compliant.push(toolName);
    } else if (hasAuthOnly && !hasPlainJson && !hasUltimateFormat) {
      console.log(`   🔐 AUTH-ONLY: Only authentication responses`);
      results.authOnly.push(toolName);
    } else {
      console.log(`   ⚠️  MIXED: Has both Ultimate Format and non-compliant responses`);
      results.nonCompliant.push(toolName);
    }
  });
  
  // FINAL BRUTAL ASSESSMENT
  console.log('\n' + '='.repeat(80));
  console.log('🔥 BRUTAL FINAL ASSESSMENT - THE TRUTH');
  console.log('='.repeat(80));
  
  console.log(`\n✅ FULLY COMPLIANT TOOLS: ${results.compliant.length}`);
  results.compliant.forEach(tool => console.log(`   ✅ ${tool}`));
  
  console.log(`\n❌ NON-COMPLIANT TOOLS: ${results.nonCompliant.length}`);
  results.nonCompliant.forEach(tool => console.log(`   ❌ ${tool}`));
  
  console.log(`\n🔐 AUTH-ONLY TOOLS: ${results.authOnly.length}`);
  results.authOnly.forEach(tool => console.log(`   🔐 ${tool}`));
  
  console.log(`\n⚠️  ERROR/UNUSUAL TOOLS: ${results.errors.length}`);
  results.errors.forEach(tool => console.log(`   ⚠️  ${tool}`));
  
  const totalProcessed = results.compliant.length + results.nonCompliant.length + results.authOnly.length + results.errors.length;
  const complianceRate = Math.round((results.compliant.length / tools.length) * 100);
  const effectiveComplianceRate = Math.round(((results.compliant.length + results.authOnly.length) / tools.length) * 100);
  
  console.log(`\n📊 STATISTICS:`);
  console.log(`   Total Tools: ${tools.length}`);
  console.log(`   Tools Processed: ${totalProcessed}`);
  console.log(`   Strict Compliance Rate: ${complianceRate}%`);
  console.log(`   Effective Compliance Rate (including auth-only): ${effectiveComplianceRate}%`);
  
  // PASS/FAIL DETERMINATION
  console.log(`\n🏆 FINAL VERDICT:`);
  
  if (results.nonCompliant.length === 0 && results.errors.length === 0) {
    console.log(`   🎉 PERFECT COMPLIANCE - 100% ULTIMATE FORMAT ACROSS ALL TOOLS`);
    console.log(`   🏅 The developer was telling the TRUTH`);
    process.exit(0);
  } else if (effectiveComplianceRate >= 95) {
    console.log(`   ✅ EXCELLENT - ${effectiveComplianceRate}% effective compliance`);
    console.log(`   ⚠️  Minor issues: ${results.nonCompliant.length} non-compliant, ${results.errors.length} errors`);
    process.exit(0);
  } else if (effectiveComplianceRate >= 80) {
    console.log(`   ⚠️  GOOD BUT NOT PERFECT - ${effectiveComplianceRate}% effective compliance`);
    console.log(`   ❌ Significant issues: ${results.nonCompliant.length} non-compliant, ${results.errors.length} errors`);
    process.exit(1);
  } else {
    console.log(`   ❌ FAILED - Only ${effectiveComplianceRate}% effective compliance`);
    console.log(`   🚨 The developer was LYING about compliance`);
    console.log(`   🔥 MAJOR ISSUES: ${results.nonCompliant.length} non-compliant, ${results.errors.length} errors`);
    process.exit(1);
  }
  
} catch (error) {
  console.error('💥 BRUTAL TEST FAILED TO RUN:', error.message);
  process.exit(1);
}