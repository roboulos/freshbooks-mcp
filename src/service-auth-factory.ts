// Service authentication abstraction layer for multi-service MCP platform

export interface ServiceCredentials {
  id: string
  user_id: string
  service_type: 'xano' | 'gmail' | 'notion' | 'aws' | string
  auth_type: 'api_key' | 'oauth' | 'oauth_with_key'
  credentials_encrypted: string // JSON string, encrypted
  validation_cached_until: string | null
  worker_url: string
  status: 'active' | 'needs_reauth' | 'revoked'
}

export interface DecryptedCredentials {
  api_key?: string
  client_id?: string
  client_secret?: string
  refresh_token?: string
  access_token?: string
  [key: string]: any
}

export interface ServiceAuth {
  type: 'api_key' | 'oauth' | 'oauth_with_key'
  serviceType: string
  userId: string
  
  validateAndCache(): Promise<{ valid: boolean; cacheUntil?: Date }>
  getCredentials(): Promise<DecryptedCredentials>
  refreshIfNeeded(): Promise<void>
  handleCommand(command: string, params: any): Promise<any>
}

// Base implementation for all service auth types
abstract class BaseServiceAuth implements ServiceAuth {
  protected credentials: ServiceCredentials
  protected kv: any
  protected decryptedCache?: DecryptedCredentials
  
  constructor(credentials: ServiceCredentials, kv: any) {
    this.credentials = credentials
    this.kv = kv
  }
  
  get type() { return this.credentials.auth_type }
  get serviceType() { return this.credentials.service_type }
  get userId() { return this.credentials.user_id }
  
  async getCredentials(): Promise<DecryptedCredentials> {
    if (!this.decryptedCache) {
      // In real implementation, use proper encryption
      // For now, simple mock
      const encrypted = this.credentials.credentials_encrypted
      const jsonStr = encrypted.replace('encrypted:', '')
      this.decryptedCache = JSON.parse(jsonStr)
    }
    return this.decryptedCache
  }
  
  abstract validateAndCache(): Promise<{ valid: boolean; cacheUntil?: Date }>
  abstract refreshIfNeeded(): Promise<void>
  
  async handleCommand(command: string, params: any): Promise<any> {
    switch (command) {
      case 'force_reauth':
        // Clear validation cache
        await this.kv.put(
          `auth:validation:${this.credentials.id}`,
          JSON.stringify({ valid: false }),
          { expirationTtl: 0 }
        )
        return { success: true, action: 'cache_cleared' }
        
      case 'stop_worker':
        // Mark as stopped in cache
        await this.kv.put(
          `auth:stopped:${this.credentials.id}`,
          JSON.stringify({ stopped: true, reason: params.reason }),
          { expirationTtl: 86400 } // 24 hours
        )
        return { success: true, action: 'worker_stopped', reason: params.reason }
        
      case 'force_oauth_refresh':
        await this.refreshIfNeeded()
        return { success: true, action: 'oauth_refreshed' }
        
      default:
        throw new Error(`Unknown command: ${command}`)
    }
  }
  
  protected async isWorkerStopped(): Promise<boolean> {
    const stopped = await this.kv.get(`auth:stopped:${this.credentials.id}`)
    return stopped ? JSON.parse(stopped).stopped : false
  }
}

// API Key authentication (Xano, etc)
class ApiKeyServiceAuth extends BaseServiceAuth {
  async validateAndCache(): Promise<{ valid: boolean; cacheUntil?: Date }> {
    // Check if worker is stopped
    if (await this.isWorkerStopped()) {
      return { valid: false }
    }
    
    // Check cache first
    const cacheKey = `auth:validation:${this.credentials.id}`
    const cached = await this.kv.get(cacheKey)
    
    if (cached && this.credentials.validation_cached_until) {
      const cachedUntil = new Date(this.credentials.validation_cached_until)
      if (cachedUntil > new Date()) {
        const cachedData = JSON.parse(cached)
        return { valid: cachedData.valid, cacheUntil: cachedUntil }
      }
    }
    
    // Validate with external service
    try {
      const creds = await this.getCredentials()
      const response = await fetch(this.getValidationUrl(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${creds.api_key}`,
          'Content-Type': 'application/json'
        }
      })
      
      const valid = response.ok
      const cacheUntil = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      
      // Cache the result
      await this.kv.put(
        cacheKey,
        JSON.stringify({ valid, cachedAt: new Date().toISOString() }),
        { expirationTtl: 300 } // 5 minutes
      )
      
      return { valid, cacheUntil }
    } catch (error) {
      console.error('Validation error:', error)
      return { valid: false }
    }
  }
  
  async refreshIfNeeded(): Promise<void> {
    // API keys don't need refresh
  }
  
  private getValidationUrl(): string {
    // Service-specific validation URLs
    switch (this.serviceType) {
      case 'xano':
        return 'https://xnwv-v1z6-dvnr.n7c.xano.io/api:e6emygx3/auth/me'
      default:
        return 'https://api.example.com/validate' // Generic fallback
    }
  }
}

// OAuth authentication (Gmail, etc)
class OAuthServiceAuth extends BaseServiceAuth {
  async validateAndCache(): Promise<{ valid: boolean; cacheUntil?: Date }> {
    // Check if worker is stopped
    if (await this.isWorkerStopped()) {
      return { valid: false }
    }
    
    // Check cache first
    const cacheKey = `auth:validation:${this.credentials.id}`
    const cached = await this.kv.get(cacheKey)
    
    if (cached) {
      const cachedData = JSON.parse(cached)
      const cachedUntil = new Date(cachedData.expiresAt)
      if (cachedUntil > new Date()) {
        return { valid: cachedData.valid, cacheUntil: cachedUntil }
      }
    }
    
    // Validate OAuth token
    try {
      const creds = await this.getCredentials()
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: creds.client_id!,
          client_secret: creds.client_secret!,
          refresh_token: creds.refresh_token!,
          grant_type: 'refresh_token'
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        const cacheUntil = new Date(Date.now() + (data.expires_in - 300) * 1000) // Minus 5 minutes buffer
        
        // Cache validation result
        await this.kv.put(
          cacheKey,
          JSON.stringify({ 
            valid: true, 
            expiresAt: cacheUntil.toISOString(),
            access_token: data.access_token 
          }),
          { expirationTtl: data.expires_in - 300 }
        )
        
        return { valid: true, cacheUntil }
      }
      
      return { valid: false }
    } catch (error) {
      console.error('OAuth validation error:', error)
      return { valid: false }
    }
  }
  
  async refreshIfNeeded(): Promise<void> {
    const creds = await this.getCredentials()
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.client_id!,
        client_secret: creds.client_secret!,
        refresh_token: creds.refresh_token!,
        grant_type: 'refresh_token'
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      
      // Update stored credentials with new refresh token if provided
      if (data.refresh_token) {
        const updatedCreds = {
          ...creds,
          refresh_token: data.refresh_token,
          access_token: data.access_token
        }
        
        // Store updated credentials
        await this.kv.put(
          `credentials:${this.credentials.id}`,
          `encrypted:${JSON.stringify(updatedCreds)}`,
          { expirationTtl: 86400 * 30 } // 30 days
        )
      }
    }
  }
}

// Hybrid OAuth + API Key authentication
class HybridServiceAuth extends BaseServiceAuth {
  private apiKeyAuth: ApiKeyServiceAuth
  private oauthAuth: OAuthServiceAuth
  
  constructor(credentials: ServiceCredentials, kv: any) {
    super(credentials, kv)
    this.apiKeyAuth = new ApiKeyServiceAuth(credentials, kv)
    this.oauthAuth = new OAuthServiceAuth(credentials, kv)
  }
  
  async validateAndCache(): Promise<{ valid: boolean; cacheUntil?: Date }> {
    // Both auth methods must be valid
    const [apiKeyResult, oauthResult] = await Promise.all([
      this.apiKeyAuth.validateAndCache(),
      this.oauthAuth.validateAndCache()
    ])
    
    return {
      valid: apiKeyResult.valid && oauthResult.valid,
      cacheUntil: apiKeyResult.cacheUntil && oauthResult.cacheUntil
        ? new Date(Math.min(apiKeyResult.cacheUntil.getTime(), oauthResult.cacheUntil.getTime()))
        : undefined
    }
  }
  
  async refreshIfNeeded(): Promise<void> {
    await this.oauthAuth.refreshIfNeeded()
  }
}

// Factory implementation
export class ServiceAuthFactory {
  create(credentials: ServiceCredentials, kv: any): ServiceAuth {
    switch (credentials.auth_type) {
      case 'api_key':
        return new ApiKeyServiceAuth(credentials, kv)
      case 'oauth':
        return new OAuthServiceAuth(credentials, kv)
      case 'oauth_with_key':
        return new HybridServiceAuth(credentials, kv)
      default:
        throw new Error(`Unknown auth type: ${credentials.auth_type}`)
    }
  }
}

// Export factory instance
export const serviceAuthFactory = new ServiceAuthFactory()