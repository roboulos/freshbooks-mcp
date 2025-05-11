import { Env } from './types/env';
import { XanoAuth } from './auth';
import { XanoFunction } from './types/xano';

/**
 * Client for interacting with Xano API
 */
export class XanoClient {
  private env: Env;
  private auth: XanoAuth;
  
  constructor(env: Env) {
    this.env = env;
    this.auth = new XanoAuth(env);
  }
  
  /**
   * Make an authenticated request to the Xano API
   * @param path API path to call
   * @param options Fetch options
   * @returns Response data
   */
  async callApi<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await this.auth.getToken();
    
    const url = `${this.env.XANO_API_BASE}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    };
    
    try {
      const response = await fetch(url, {
        ...options,
        headers
      });
      
      // Handle token expiration
      if (response.status === 401) {
        // Token expired, refresh and retry
        await this.auth.refreshToken();
        return this.callApi<T>(path, options);
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Xano API error (${response.status}): ${errorData.message || response.statusText}`);
      }
      
      return await response.json<T>();
    } catch (error) {
      console.error(`Error calling Xano API at ${path}:`, error);
      throw error;
    }
  }
  
  /**
   * Get all available functions from Xano
   * @returns List of available functions
   */
  async getFunctions(): Promise<XanoFunction[]> {
    return this.callApi<XanoFunction[]>('/functions');
  }
  
  /**
   * Call a specific Xano function
   * @param functionName Name of the function to call
   * @param parameters Parameters to pass to the function
   * @returns Function result
   */
  async callFunction<T>(functionName: string, parameters: Record<string, any>): Promise<T> {
    return this.callApi<T>(`/functions/${functionName}`, {
      method: 'POST',
      body: JSON.stringify(parameters)
    });
  }
  
  /**
   * Search records in Xano database
   * @param entity Entity to search
   * @param query Search query
   * @param filters Additional filters
   * @returns Search results
   */
  async search<T>(entity: string, query: string, filters: Record<string, any> = {}): Promise<T[]> {
    return this.callApi<T[]>(`/${entity}/search`, {
      method: 'POST',
      body: JSON.stringify({
        query,
        filters
      })
    });
  }
  
  /**
   * Create a new record in Xano
   * @param entity Entity to create in
   * @param data Record data
   * @returns Created record
   */
  async create<T>(entity: string, data: Record<string, any>): Promise<T> {
    return this.callApi<T>(`/${entity}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
}