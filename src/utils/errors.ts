/**
 * Standard error codes for MCP responses
 */
export enum ErrorCode {
  // JSON-RPC standard error codes
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  
  // MCP-specific error codes
  AUTHENTICATION_ERROR = -32000,
  AUTHORIZATION_ERROR = -32001,
  TOOL_ERROR = -32002,
  XANO_API_ERROR = -32003,
  TIMEOUT_ERROR = -32004,
  RATE_LIMIT_ERROR = -32005,
}

/**
 * Creates a standardized JSON-RPC error response
 * @param code Error code
 * @param message Error message
 * @param data Additional error data
 * @param id Request ID (null for notifications)
 * @returns Formatted error response
 */
export function createJsonRpcError(
  code: ErrorCode,
  message: string,
  data?: any,
  id: string | number | null = null
) {
  return {
    jsonrpc: '2.0',
    error: {
      code,
      message,
      data
    },
    id
  };
}

/**
 * Creates a standard HTTP error response
 * @param status HTTP status code
 * @param message Error message
 * @param details Additional error details
 * @returns Response object
 */
export function createErrorResponse(
  status: number,
  message: string,
  details?: any
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      details
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  );
}

/**
 * Base error class for MCP server errors
 */
export class McpError extends Error {
  code: ErrorCode;
  status: number;
  details?: any;
  
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    status: number = 500,
    details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.details = details;
  }
  
  /**
   * Convert to JSON-RPC error
   * @param id Request ID
   * @returns JSON-RPC error object
   */
  toJsonRpcError(id: string | number | null = null) {
    return createJsonRpcError(this.code, this.message, this.details, id);
  }
  
  /**
   * Convert to HTTP error response
   * @returns Response object
   */
  toResponse(): Response {
    return createErrorResponse(this.status, this.message, this.details);
  }
}

/**
 * Error for authentication failures
 */
export class AuthenticationError extends McpError {
  constructor(message: string, details?: any) {
    super(
      message,
      ErrorCode.AUTHENTICATION_ERROR,
      401,
      details
    );
  }
}

/**
 * Error for authorization failures
 */
export class AuthorizationError extends McpError {
  constructor(message: string, details?: any) {
    super(
      message,
      ErrorCode.AUTHORIZATION_ERROR,
      403,
      details
    );
  }
}

/**
 * Error for tool failures
 */
export class ToolError extends McpError {
  constructor(message: string, details?: any) {
    super(
      message,
      ErrorCode.TOOL_ERROR,
      500,
      details
    );
  }
}

/**
 * Error for Xano API failures
 */
export class XanoApiError extends McpError {
  constructor(message: string, details?: any) {
    super(
      message,
      ErrorCode.XANO_API_ERROR,
      500,
      details
    );
  }
}

/**
 * Error for operation timeouts
 */
export class TimeoutError extends McpError {
  constructor(message: string, details?: any) {
    super(
      message,
      ErrorCode.TIMEOUT_ERROR,
      504,
      details
    );
  }
}

/**
 * Error for rate limiting
 */
export class RateLimitError extends McpError {
  constructor(message: string, details?: any) {
    super(
      message,
      ErrorCode.RATE_LIMIT_ERROR,
      429,
      details
    );
  }
}