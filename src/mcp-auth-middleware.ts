import { XanoAuthService } from './auth-service'
import { serviceAuthFactory, type ServiceCredentials } from './service-auth-factory'

export interface AuthenticatedEnv {
  KV: any
  XANO_API_KEY: string
  XANO_INSTANCE: string
  SESSION_CACHE: any
}

export interface AuthResult {
  authenticated: boolean
  userId?: string
  sessionId?: string
  error?: string
}

export interface UsageLogData {
  sessionId: string
  userId: string
  toolName: string
  params: any
  result?: any
  error?: any
  duration: number
}

export class MCPAuthMiddleware {
  private authService: XanoAuthService
  private env: AuthenticatedEnv

  constructor(env: AuthenticatedEnv) {
    this.env = env
    this.authService = new XanoAuthService()
  }

  /**
   * Authenticates incoming MCP requests
   */
  async authenticate(request: Request, env: AuthenticatedEnv): Promise<AuthResult> {
    try {
      // Extract API key from Authorization header
      const authHeader = request.headers.get('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { authenticated: false, error: 'Missing Authorization header' }
      }

      const apiKey = authHeader.substring(7) // Remove 'Bearer ' prefix
      
      // Check API key cache first
      const cachedApiKey = await env.SESSION_CACHE.get(`apikey:${apiKey}`)
      if (cachedApiKey) {
        const cached = JSON.parse(cachedApiKey)
        const cachedAt = new Date(cached.cachedAt)
        const now = new Date()
        // Check if cache is less than 5 minutes old
        if (now.getTime() - cachedAt.getTime() < 5 * 60 * 1000) {
          // Create or reuse session
          const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          return {
            authenticated: true,
            userId: cached.userId,
            sessionId: newSessionId
          }
        }
      }
      
      // Check session cache
      const sessionId = request.headers.get('X-Session-ID')
      if (sessionId) {
        const cachedSession = await env.SESSION_CACHE.get(`session:${sessionId}`)
        if (cachedSession) {
          const session = JSON.parse(cachedSession)
          // Check if session is still valid (24 hour timeout)
          const lastActive = new Date(session.lastActive)
          const now = new Date()
          if (now.getTime() - lastActive.getTime() < 24 * 60 * 60 * 1000) {
            // Update last active time
            session.lastActive = now.toISOString()
            await env.SESSION_CACHE.put(
              `session:${sessionId}`,
              JSON.stringify(session),
              { expirationTtl: 86400 } // 24 hours
            )
            return {
              authenticated: true,
              userId: session.userId,
              sessionId: session.sessionId
            }
          }
        }
      }

      // Validate API key with Xano
      const validationResult = await this.authService.validateApiKey(apiKey)
      if (!validationResult.valid || !validationResult.user) {
        return { authenticated: false, error: 'Invalid API key' }
      }

      // Create new session
      const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const sessionData = {
        sessionId: newSessionId,
        userId: validationResult.user.id,
        lastActive: new Date().toISOString(),
        userEmail: validationResult.user.email
      }

      // Cache the session
      await env.SESSION_CACHE.put(
        `session:${newSessionId}`,
        JSON.stringify(sessionData),
        { expirationTtl: 86400 } // 24 hours
      )

      // Also cache the API key validation
      await env.SESSION_CACHE.put(
        `apikey:${apiKey}`,
        JSON.stringify({
          userId: validationResult.user.id,
          valid: true,
          cachedAt: new Date().toISOString()
        }),
        { expirationTtl: 300 } // 5 minutes
      )

      return {
        authenticated: true,
        userId: validationResult.user.id,
        sessionId: newSessionId
      }
    } catch (error) {
      console.error('Authentication error:', error)
      return { authenticated: false, error: 'Authentication failed' }
    }
  }

  /**
   * Wraps a tool handler with usage logging
   */
  wrapToolCall(
    toolName: string,
    handler: Function,
    sessionId: string,
    userId: string
  ): Function {
    return async (...args: any[]) => {
      const startTime = Date.now()
      let result: any
      let error: any

      try {
        // Execute the actual tool
        result = await handler(...args)
        return result
      } catch (err) {
        error = err
        throw err
      } finally {
        // Log usage asynchronously - don't await
        const duration = Date.now() - startTime
        this.logUsage({
          sessionId,
          userId,
          toolName,
          params: args[0] || {},
          result,
          error: error?.message,
          duration
        }).catch(err => {
          console.error('Failed to log usage:', err)
        })
      }
    }
  }

  /**
   * Logs tool usage asynchronously
   */
  async logUsage(data: UsageLogData): Promise<void> {
    try {
      // Queue the usage log for batch processing
      const queueKey = `usage:queue:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      await this.env.KV.put(
        queueKey,
        JSON.stringify({
          ...data,
          timestamp: new Date().toISOString(),
          ip_address: '0.0.0.0', // Would come from request in real implementation
          ai_model: 'claude-3', // Would be detected from request
          cost: this.calculateCost(data.toolName)
        }),
        {
          expirationTtl: 3600, // 1 hour - batch processor should handle before this
          metadata: {
            sessionId: data.sessionId,
            userId: data.userId
          }
        }
      )
    } catch (error) {
      // Don't throw - logging failures shouldn't break tool execution
      console.error('Usage logging error:', error)
    }
  }

  /**
   * Calculate estimated cost for tool usage
   */
  private calculateCost(toolName: string): number {
    // Simple cost model - would be more sophisticated in production
    const costMap: Record<string, number> = {
      'xano_list_databases': 0.001,
      'xano_list_tables': 0.001,
      'xano_get_table_schema': 0.002,
      'xano_create_table': 0.005,
      'xano_update_table': 0.003,
      'xano_delete_table': 0.003,
      'xano_browse_table_content': 0.002,
      'xano_create_table_record': 0.002,
      'xano_update_table_record': 0.002,
      'xano_delete_table_record': 0.002
    }
    
    return costMap[toolName] || 0.001
  }
}

// Export factory function
export function createMCPAuthMiddleware(env: AuthenticatedEnv): MCPAuthMiddleware {
  return new MCPAuthMiddleware(env)
}