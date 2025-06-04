import { readFileSync, writeFileSync } from 'fs';

/**
 * Script to merge enhanced functionality into existing index.ts
 * This preserves all existing tools while adding new capabilities
 */

// Read current index.ts
const indexPath = './src/index.ts';
const currentIndex = readFileSync(indexPath, 'utf-8');

// Find where MyMCP class starts
const classStart = currentIndex.indexOf('export class MyMCP');
const importsEnd = currentIndex.indexOf('export type XanoAuthProps');

// Extract imports section
const imports = currentIndex.substring(0, importsEnd);

// Add new imports
const enhancedImports = `import { XanoSessionManager } from "./xano-session-manager";
import { SmartError } from "./smart-error";
import { SmartResponseWrapper } from "./smart-response-wrapper";
import type { Env as EnvType, SetContextParams } from "./types";

// Preserve existing Env type
interface Env extends EnvType {
  OAUTH_KV: KVNamespace;
  JWT_SECRET: string;
  SNAPPY_MCP_DURABLE_OBJECT: DurableObjectNamespace;
}

`;

// Find the init() method
const initStart = currentIndex.indexOf('async init() {');
const initEnd = currentIndex.lastIndexOf('}') + 1;

// Create enhanced class with session management
const enhancedClass = `
export class MyMCP extends McpAgent<Env, unknown, XanoAuthProps> {
  private sessionManager: XanoSessionManager | null = null;
  private responseWrapper: SmartResponseWrapper;
  
  server = new McpServer({
    name: "Snappy MCP Server",
    version: "2.0.0",
  }, {
    capabilities: {
      tools: {},
      prompts: {}
    }
  });

  constructor(env: Env, authProps?: XanoAuthProps) {
    super(env, authProps);
    this.responseWrapper = new SmartResponseWrapper();
  }

  /**
   * Get or create session manager
   */
  private async getSession(): Promise<XanoSessionManager> {
    if (!this.sessionManager) {
      console.log('[Session] Creating new session manager', {
        sessionId: this.props?.sessionId,
        userId: this.props?.userId
      });
      
      this.sessionManager = new XanoSessionManager(this.env, this.props || {
        authenticated: false,
        sessionId: 'anonymous'
      });
      await this.sessionManager.initialize();
    }
    return this.sessionManager;
  }

  async getFreshApiKey(): Promise<string | null> {
    return this.props?.apiKey || null;
  }

  ${currentIndex.substring(classStart + 'export class MyMCP extends McpAgent<Env, unknown, XanoAuthProps> {'.length, initStart)}

  async init() {
    console.log('[Init] Initializing Snappy MCP Server 2.0');
    
    // Add new context management tools
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
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                context: {
                  instance: params.instance_name,
                  workspace: params.workspace_id,
                  message: "Context set! All subsequent commands will use these defaults."
                },
                tips: [
                  "You no longer need to specify instance_name or workspace_id",
                  "Use xano_get_context to see current settings"
                ]
              }, null, 2)
            }]
          };
        } catch (error) {
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
        } catch (error) {
          return this.responseWrapper.wrapError('xano_get_context', error);
        }
      }
    );

    // Continue with existing tools...
    ${currentIndex.substring(initStart + 'async init() {'.length, initEnd - 1)}
  }
}
`;

// Create the merged file
const mergedContent = imports + enhancedImports + enhancedClass;

// Write to a new file for review
writeFileSync('./src/index-enhanced.ts', mergedContent);

console.log('✅ Enhanced index.ts created at src/index-enhanced.ts');
console.log('Review the file and rename to index.ts when ready');