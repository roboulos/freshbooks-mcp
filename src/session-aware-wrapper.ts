import { XanoSessionManager } from './xano-session-manager';
import { SmartResponseWrapper } from './smart-response-wrapper';

/**
 * Wraps tool handlers to automatically inject session parameters
 * and handle natural language references
 */
export class SessionAwareToolWrapper {
  private responseWrapper: SmartResponseWrapper;

  constructor(
    private sessionManager: XanoSessionManager,
    private toolName: string
  ) {
    this.responseWrapper = new SmartResponseWrapper();
  }

  /**
   * Wrap a tool handler to add session awareness
   */
  wrap(handler: Function): Function {
    return async (params: any) => {
      try {
        // Enrich parameters with session defaults
        const enrichedParams = await this.enrichParams(params);
        
        // Call the original handler
        const result = await handler(enrichedParams);
        
        // Wrap successful response
        return this.responseWrapper.wrapSuccess(this.toolName, result);
      } catch (error) {
        // Wrap error response
        return this.responseWrapper.wrapError(this.toolName, error);
      }
    };
  }

  /**
   * Enrich parameters with session defaults and resolve references
   */
  private async enrichParams(params: any): Promise<any> {
    // Get session defaults
    const enriched = this.sessionManager.enrichParams(params);
    
    // Resolve natural language table references
    if (enriched.table && typeof enriched.table === 'string') {
      try {
        // First try exact match, then with emoji stripping
        enriched.table_id = this.sessionManager.resolveTableReference(enriched.table, true);
        enriched._resolved_table = enriched.table;
        delete enriched.table; // Remove string reference, keep ID
      } catch (error) {
        // If not in cache, keep the string and let the tool handle it
        // This allows the tool to fetch and cache the table
      }
    }
    
    // Resolve table_id if it's a string (natural language)
    if (enriched.table_id && typeof enriched.table_id === 'string') {
      try {
        const resolvedId = this.sessionManager.resolveTableReference(enriched.table_id, true);
        enriched._resolved_table = enriched.table_id;
        enriched.table_id = resolvedId;
      } catch (error) {
        // Keep as is if not found
      }
    }
    
    return enriched;
  }
}

/**
 * Helper to create a session-aware tool definition
 */
export function createSessionAwareTool(
  server: any,
  sessionManager: XanoSessionManager,
  toolName: string,
  schema: any,
  handler: Function
) {
  const wrapper = new SessionAwareToolWrapper(sessionManager, toolName);
  
  // Make instance_name and workspace_id optional in schema
  if (schema.instance_name) {
    schema.instance_name = schema.instance_name.optional();
  }
  if (schema.workspace_id) {
    schema.workspace_id = schema.workspace_id.optional();
  }
  
  // Register the wrapped tool
  server.tool(toolName, schema, wrapper.wrap(handler));
}