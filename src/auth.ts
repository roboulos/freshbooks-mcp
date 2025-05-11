import { Env } from './types/env';
import { XanoAuthResponse } from './types/xano';

/**
 * Handles authentication with Xano backend
 */
export class XanoAuth {
  private env: Env;
  private token: string | null = null;
  private tokenExpiry: number = 0;
  
  constructor(env: Env) {
    this.env = env;
  }
  
  /**
   * Get a valid authentication token, refreshing if needed
   * @returns The authentication token
   */
  async getToken(): Promise<string> {
    // Check if we have a cached token
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }
    
    // Check if we have a token in KV
    const storedToken = await this.env.AUTH_TOKENS.get('xano_token');
    const storedExpiry = await this.env.AUTH_TOKENS.get('xano_expiry');
    
    if (storedToken && storedExpiry && Date.now() < parseInt(storedExpiry)) {
      this.token = storedToken;
      this.tokenExpiry = parseInt(storedExpiry);
      return this.token;
    }
    
    // Need to get a new token
    return this.refreshToken();
  }
  
  /**
   * Force refresh the authentication token
   * @returns The new authentication token
   */
  async refreshToken(): Promise<string> {
    console.log('Refreshing Xano authentication token');
    
    try {
      const response = await fetch(`${this.env.XANO_API_BASE}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.env.XANO_CLIENT_ID,
          client_secret: this.env.XANO_CLIENT_SECRET,
          grant_type: 'client_credentials'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json<XanoAuthResponse>();
      
      // Store the token with 5 minute buffer before expiry
      this.token = data.token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - (5 * 60 * 1000);
      
      // Save to KV for persistence across worker invocations
      await this.env.AUTH_TOKENS.put('xano_token', this.token);
      await this.env.AUTH_TOKENS.put('xano_expiry', this.tokenExpiry.toString());
      
      return this.token;
    } catch (error) {
      console.error('Error refreshing Xano token:', error);
      throw new Error(`Failed to authenticate with Xano: ${error.message}`);
    }
  }
  
  /**
   * Check if a token is valid
   * @param token Token to validate
   * @returns Whether the token is valid
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.env.XANO_API_BASE}/auth/validate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.ok;
    } catch (error) {
      console.error('Error validating token:', error);
      return false;
    }
  }
}