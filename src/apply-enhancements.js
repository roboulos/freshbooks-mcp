const fs = require('fs');
const path = require('path');

/**
 * Script to apply session management enhancements to existing tools
 */

const indexPath = path.join(__dirname, 'index.ts');
let content = fs.readFileSync(indexPath, 'utf-8');

// Add imports at the top
const imports = `import { XanoSessionManager } from "./xano-session-manager";
import { SmartError } from "./smart-error";
import { SmartResponseWrapper } from "./smart-response-wrapper";
import type { Env as EnvType, SetContextParams } from "./types";

`;

// Add imports after existing imports
const importInsertPoint = content.indexOf('// Use the Props type');
content = content.slice(0, importInsertPoint) + imports + content.slice(importInsertPoint);

// Add session manager property to MyMCP class
const classDeclaration = content.indexOf('export class MyMCP extends McpAgent');
const serverDeclaration = content.indexOf('server = new McpServer({');

const sessionManagerProperty = `
  private sessionManager: XanoSessionManager | null = null;
  private responseWrapper: SmartResponseWrapper = new SmartResponseWrapper();
  
`;

content = content.slice(0, serverDeclaration) + sessionManagerProperty + '  ' + content.slice(serverDeclaration);

// Add getSession method after getFreshApiKey
const getFreshApiKeyEnd = content.indexOf('}', content.indexOf('getFreshApiKey')) + 1;

const getSessionMethod = `

  /**
   * Get or create session manager
   */
  private async getSession(): Promise<XanoSessionManager> {
    if (!this.sessionManager) {
      console.log('[Session] Creating new session manager');
      
      this.sessionManager = new XanoSessionManager(this.env, this.props || {
        authenticated: false,
        sessionId: 'anonymous'
      });
      await this.sessionManager.initialize();
    }
    return this.sessionManager;
  }
`;

content = content.slice(0, getFreshApiKeyEnd) + getSessionMethod + content.slice(getFreshApiKeyEnd);

// Update server version
content = content.replace(
  'name: "Snappy MCP Server",\n    version: "1.0.0",',
  'name: "Snappy MCP Server",\n    version: "2.0.0",'
);

// Add capabilities
content = content.replace(
  'version: "2.0.0",\n  });',
  'version: "2.0.0",\n  }, {\n    capabilities: {\n      tools: {},\n      prompts: {}\n    }\n  });'
);

// Find all tool definitions and make instance_name and workspace_id optional
const toolRegex = /instance_name:\s*z\.string\(\)\.describe\([^)]+\)/g;
content = content.replace(toolRegex, (match) => {
  if (!match.includes('.optional()')) {
    return match.replace(')', ').optional()');
  }
  return match;
});

const workspaceRegex = /workspace_id:\s*z\.(string|number)\(\)\.describe\([^)]+\)/g;
content = content.replace(workspaceRegex, (match) => {
  if (!match.includes('.optional()')) {
    return match.replace(')', ').optional()');
  }
  return match;
});

// Add context tools at the beginning of init()
const initStart = content.indexOf('async init() {');
const firstToolIndex = content.indexOf('this.server.tool(', initStart);

const contextTools = `
    console.log('[Init] Initializing Snappy MCP Server 2.0 with session management');
    
    // Core session management tool
    this.server.tool(
      "xano_set_context",
      {
        instance_name: z.string()
          .optional()
          .describe("Instance name (auto-completes domain)"),
        workspace_id: z.number()
          .optional()
          .describe("Workspace ID to use as default"),
        discover: z.boolean()
          .default(true)
          .describe("Auto-discover workspaces if not specified")
      },
      async (params) => {
        try {
          if (!this.props?.authenticated) {
            throw SmartError.authRequired();
          }
          
          const session = await this.getSession();
          
          // Auto-complete instance name
          if (params.instance_name && !params.instance_name.includes('.')) {
            const patterns = ['.n7c.xano.io', '.n7.xano.io', '.xano.io'];
            for (const pattern of patterns) {
              const full = params.instance_name + pattern;
              if (full.match(/^[a-z0-9-]+\\.(n7c?\\.)?xano\\.io$/)) {
                params.instance_name = full;
                break;
              }
            }
          }
          
          await session.setContext(params as SetContextParams);
          
          let instance, workspace;
          try {
            instance = session.getInstanceName();
          } catch {}
          try {
            workspace = session.getWorkspaceId();
          } catch {}
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                context: {
                  instance,
                  workspace,
                  message: "Context set! All subsequent commands will use these defaults."
                },
                tips: [
                  "You no longer need to specify instance_name or workspace_id",
                  "Use xano_get_context to see current settings"
                ]
              }, null, 2)
            }]
          };
        } catch (error: any) {
          return this.responseWrapper.wrapError('xano_set_context', error);
        }
      }
    );

    this.server.tool(
      "xano_get_context",
      {},
      async () => {
        try {
          const session = await this.getSession();
          const sessionData = session.getSession();
          
          let instance, workspace;
          try {
            instance = session.getInstanceName();
          } catch {}
          try {
            workspace = session.getWorkspaceId();
          } catch {}
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                instance,
                workspace,
                cached_tables: sessionData?.tableNameCache.size || 0,
                session_age_minutes: sessionData ? 
                  Math.floor((Date.now() - sessionData.lastAccessed) / 60000) : 0
              }, null, 2)
            }]
          };
        } catch (error: any) {
          return this.responseWrapper.wrapError('xano_get_context', error);
        }
      }
    );

`;

content = content.slice(0, firstToolIndex) + contextTools + '\n    ' + content.slice(firstToolIndex);

// Write the enhanced file
fs.writeFileSync(path.join(__dirname, 'index-enhanced.ts'), content);

console.log('✅ Enhanced index.ts created at src/index-enhanced.ts');
console.log('✅ Made instance_name and workspace_id optional in all tools');
console.log('✅ Added xano_set_context and xano_get_context tools');
console.log('📝 Review and test before replacing index.ts');