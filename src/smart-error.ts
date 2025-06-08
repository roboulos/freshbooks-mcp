/**
 * SmartError - Enhanced error handling for MCP tools
 * 
 * Provides helpful error messages with examples and guidance,
 * following Cloudflare's MCP best practices for detailed parameter descriptions.
 */

export interface SmartErrorExamples {
  correct?: string;
  wrong?: string;
  tip?: string;
  relatedTools?: string[];
  availableOptions?: string[];
}

export class SmartError extends Error {
  constructor(
    public message: string,
    public hint: string,
    public examples: SmartErrorExamples = {}
  ) {
    super(message);
    this.name = 'SmartError';
  }

  /**
   * Convert to MCP response format as specified in Cloudflare docs
   */
  toMCPResponse() {
    return {
      content: [{ 
        type: "text", 
        text: this.formatMessage()
      }]
    };
  }

  private formatMessage(): string {
    let message = `❌ ${this.message}\n\n💡 ${this.hint}`;

    if (this.examples.wrong) {
      message += `\n\n❌ Wrong:\n${this.examples.wrong}`;
    }

    if (this.examples.correct) {
      message += `\n\n✅ Correct:\n${this.examples.correct}`;
    }

    if (this.examples.tip) {
      message += `\n\n💡 Tip: ${this.examples.tip}`;
    }

    if (this.examples.availableOptions && this.examples.availableOptions.length > 0) {
      message += `\n\n📋 Available options: ${this.examples.availableOptions.slice(0, 5).join(', ')}`;
      if (this.examples.availableOptions.length > 5) {
        message += ` (and ${this.examples.availableOptions.length - 5} more)`;
      }
    }

    if (this.examples.relatedTools && this.examples.relatedTools.length > 0) {
      message += `\n\n🔧 Related tools: ${this.examples.relatedTools.join(', ')}`;
    }

    return message;
  }

  /**
   * Factory methods for common error types
   */
  static instanceRequired(): SmartError {
    return new SmartError(
      "Instance name is required",
      "Provide the Xano instance identifier",
      {
        correct: '"xnwv-v1z6-dvnr" or "xnwv-v1z6-dvnr.n7c.xano.io"',
        tip: "Domain extension (.n7c.xano.io) will be added automatically",
        relatedTools: ["xano_list_instances"]
      }
    );
  }

  static workspaceRequired(): SmartError {
    return new SmartError(
      "Workspace ID is required",
      "Provide the Xano workspace/database ID",
      {
        correct: 'workspace_id: 7 or workspace_id: "7"',
        tip: "Use xano_list_databases to find workspace IDs",
        relatedTools: ["xano_list_databases"]
      }
    );
  }

  static tableNotFound(tableName: string, availableTables: string[] = []): SmartError {
    return new SmartError(
      `Table '${tableName}' not found`,
      "Check the table name spelling and make sure it exists",
      {
        correct: availableTables.length > 0 ? availableTables[0] : "Use exact table name from xano_list_tables",
        tip: "Table names are case-sensitive and may include emoji prefixes",
        availableOptions: availableTables,
        relatedTools: ["xano_list_tables", "xano_get_table_details"]
      }
    );
  }

  static xanoScriptSyntax(issue: string, wrongCode?: string, correctCode?: string): SmartError {
    return new SmartError(
      `XanoScript syntax error: ${issue}`,
      "XanoScript has specific syntax requirements",
      {
        wrong: wrongCode,
        correct: correctCode,
        tip: "Use xano_validate_script to check syntax before creating APIs",
        relatedTools: ["xano_validate_script", "xano_get_pattern"]
      }
    );
  }

  static invalidParameter(paramName: string, value: string, expectedFormat: string): SmartError {
    return new SmartError(
      `Invalid ${paramName}: '${value}'`,
      `Parameter ${paramName} must be in the correct format`,
      {
        correct: expectedFormat,
        tip: `Check parameter documentation for ${paramName} format requirements`
      }
    );
  }

  static authenticationFailed(): SmartError {
    return new SmartError(
      "Authentication failed",
      "Your Xano credentials are invalid or expired",
      {
        tip: "Check your email and password, or try logging in to Xano directly",
        relatedTools: ["xano_auth_me"]
      }
    );
  }

  static resourceConflict(resourceType: string, name: string): SmartError {
    return new SmartError(
      `${resourceType} '${name}' already exists`,
      `A ${resourceType.toLowerCase()} with this name is already in use`,
      {
        tip: `Use a different name or update the existing ${resourceType.toLowerCase()}`,
        relatedTools: [`xano_list_${resourceType.toLowerCase()}s`, `xano_update_${resourceType.toLowerCase()}`]
      }
    );
  }
}

/**
 * Utility function to normalize instance names
 * Follows Cloudflare's guidelines for input processing
 */
export function normalizeInstanceName(instanceName: string): string {
  if (!instanceName || instanceName.trim() === '') {
    throw SmartError.instanceRequired();
  }

  const trimmed = instanceName.trim();

  // Already a full domain? Return as-is
  if (trimmed.includes('.xano.io')) {
    return trimmed;
  }
  
  // Just the prefix? Add most common domain
  return trimmed + '.n7c.xano.io';
}

/**
 * Utility function to handle table name or ID resolution
 */
export function normalizeTableIdentifier(tableOrId: string | number): { 
  isId: boolean; 
  value: string; 
} {
  if (typeof tableOrId === 'number') {
    return { isId: true, value: String(tableOrId) };
  }

  const str = String(tableOrId).trim();
  
  // If it's all digits, treat as ID
  if (/^\d+$/.test(str)) {
    return { isId: true, value: str };
  }
  
  // Otherwise it's a table name
  return { isId: false, value: str };
}

/**
 * Resolve table name to ID by looking up in tables list
 */
export async function resolveTableId(
  tableName: string, 
  workspaceId: string | number,
  instanceName: string,
  token: string,
  env: any
): Promise<string> {
  // Import here to avoid circular dependency
  const { makeApiRequest, getMetaApiUrl, formatId } = require('./utils');
  
  try {
    // Get list of tables
    const metaApi = getMetaApiUrl(instanceName);
    const url = `${metaApi}/workspace/${formatId(workspaceId)}/table`;
    const result = await makeApiRequest(url, token, "GET", undefined, env);

    if (result.error) {
      throw new SmartError(
        "Cannot resolve table name",
        "Failed to fetch tables list to resolve table name",
        {
          tip: "Check workspace ID and permissions",
          relatedTools: ["xano_list_tables"]
        }
      );
    }

    const tables = Array.isArray(result) ? result : [];
    
    // Try different matching strategies
    const match = tables.find(t => 
      // Exact match
      t.name === tableName || 
      // Case-insensitive match
      t.name.toLowerCase() === tableName.toLowerCase() ||
      // Strip emoji prefix and match (e.g., "👤 users" matches "users")
      t.name.replace(/^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+\s+/u, '') === tableName ||
      t.name.replace(/^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+\s+/u, '').toLowerCase() === tableName.toLowerCase()
    );

    if (!match) {
      throw SmartError.tableNotFound(tableName, tables.map(t => t.name));
    }

    return String(match.id);
  } catch (error) {
    if (error instanceof SmartError) {
      throw error;
    }
    
    throw new SmartError(
      "Failed to resolve table name",
      "Error occurred while looking up table by name",
      {
        tip: error.message,
        relatedTools: ["xano_list_tables"]
      }
    );
  }
}