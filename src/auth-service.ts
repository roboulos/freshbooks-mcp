// Authentication service to coordinate with Xano backend
export interface XanoUser {
  id: string
  email: string
  name: string
  api_key: string | null
  subscription_tier: string
  status: string
  last_login: string | null
}

export interface MCPSession {
  id: number
  session_id: string
  user_id: string
  client_info: object
  last_active: string
  status: string
}

export interface UsageLog {
  id: number
  session_id: string
  user_id: string | null
  function_id: number
  input_params: object
  output_result: object
  http_status: number
  response_time_ms: number
  error_message: string | null
  ai_model: string | null
  ip_address: string | null
  cost: number
}

export interface AuthService {
  validateApiKey(apiKey: string): Promise<{ valid: boolean; user?: XanoUser }>
  createSession(userId: string, clientInfo: object): Promise<MCPSession>
  updateSessionActivity(sessionId: string): Promise<void>
  logUsage(usageData: Partial<UsageLog>): Promise<UsageLog>
  validateSession(sessionId: string): Promise<{ valid: boolean; session?: MCPSession }>
}

export class XanoAuthService implements AuthService {
  private baseUrl: string
  private mcpBaseUrl: string
  
  constructor(env?: any) {
    this.baseUrl = env?.XANO_BASE_URL || 'https://xnwv-v1z6-dvnr.n7c.xano.io'
    if (env?.XANO_API_ENDPOINT) {
      this.baseUrl += env.XANO_API_ENDPOINT
    } else {
      this.baseUrl += '/api:e6emygx3'
    }
    
    // MCP endpoints use different API path
    this.mcpBaseUrl = env?.XANO_BASE_URL || 'https://xnwv-v1z6-dvnr.n7c.xano.io'
    this.mcpBaseUrl += '/api:q3EJkKDR'
  }

  /**
   * Validates API key by calling Xano auth/me endpoint
   */
  async validateApiKey(apiKey: string): Promise<{ valid: boolean; user?: XanoUser }> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        return { valid: false }
      }

      const data = await response.json()
      return { 
        valid: true, 
        user: data.self as XanoUser 
      }
    } catch (error) {
      console.error('API key validation error:', error)
      return { valid: false }
    }
  }

  /**
   * Creates a new MCP session in Xano
   */
  async createSession(userId: string, clientInfo: object): Promise<MCPSession> {
    try {
      // Generate unique session ID
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      const response = await fetch(`${this.mcpBaseUrl}/mcp_sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: sessionId,
          user_id: userId,
          client_info: clientInfo,
          status: 'active'
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`)
      }

      const session = await response.json()
      return session as MCPSession
    } catch (error) {
      console.error('Session creation error:', error)
      throw error
    }
  }

  /**
   * Updates session activity timestamp
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      const response = await fetch(`${this.mcpBaseUrl}/mcp_sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          last_active: new Date().toISOString(),
          status: 'active'
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to update session activity: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Session activity update error:', error)
      // Don't throw - this is not critical
    }
  }

  /**
   * Validates existing session
   */
  async validateSession(sessionId: string): Promise<{ valid: boolean; session?: MCPSession }> {
    try {
      const response = await fetch(`${this.mcpBaseUrl}/mcp_sessions/${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        return { valid: false }
      }

      const session = await response.json()
      
      // Check if session is still active and not expired
      const lastActive = new Date(session.last_active)
      const now = new Date()
      const sessionTimeout = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
      
      if (session.status !== 'active' || (now.getTime() - lastActive.getTime()) > sessionTimeout) {
        return { valid: false }
      }

      return { 
        valid: true, 
        session: session as MCPSession 
      }
    } catch (error) {
      console.error('Session validation error:', error)
      return { valid: false }
    }
  }

  /**
   * Logs usage to Xano usage_logs table
   */
  async logUsage(usageData: Partial<UsageLog>): Promise<UsageLog> {
    try {
      const response = await fetch(`${this.mcpBaseUrl}/usage_logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: usageData.session_id,
          user_id: usageData.user_id,
          function_id: usageData.function_id || 0,
          input_params: usageData.input_params || {},
          output_result: usageData.output_result || {},
          http_status: usageData.http_status || 200,
          response_time_ms: usageData.response_time_ms || 0,
          error_message: usageData.error_message,
          ai_model: usageData.ai_model,
          ip_address: usageData.ip_address,
          cost: usageData.cost || 0
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to log usage: ${response.statusText}`)
      }

      const log = await response.json()
      return log as UsageLog
    } catch (error) {
      console.error('Usage logging error:', error)
      throw error
    }
  }
}

// Factory function for easier testing
export function createAuthService(): AuthService {
  return new XanoAuthService()
}