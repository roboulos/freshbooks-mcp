import { Env } from './types/env';

/**
 * SessionObject for managing stateful MCP sessions using Durable Objects
 */
export class SessionObject implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private sessionData: Map<string, any>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessionData = new Map();
    
    // Initialize from stored state
    this.state.blockConcurrencyWhile(async () => {
      const storedData = await this.state.storage.get('sessionData');
      if (storedData) {
        this.sessionData = new Map(Object.entries(storedData));
      }
    });
  }

  /**
   * Handle requests to this Durable Object
   * @param request Incoming request
   * @returns Response
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.split('/').pop();

    try {
      switch (path) {
        case 'get':
          return this.handleGet(request);
        case 'set':
          return this.handleSet(request);
        case 'delete':
          return this.handleDelete(request);
        case 'clear':
          return this.handleClear(request);
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Session operation failed',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle get request to retrieve session data
   * @param request Incoming request
   * @returns Response with session data
   */
  private async handleGet(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');

    if (key) {
      // Get specific key
      const value = this.sessionData.get(key);
      return new Response(JSON.stringify({ value }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Get all data
      const data = Object.fromEntries(this.sessionData);
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle set request to store session data
   * @param request Incoming request
   * @returns Response confirming data was set
   */
  private async handleSet(request: Request): Promise<Response> {
    const { key, value } = await request.json();

    if (!key) {
      return new Response(JSON.stringify({
        error: 'Missing key'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Set the value
    this.sessionData.set(key, value);
    
    // Persist to storage
    await this.state.storage.put('sessionData', Object.fromEntries(this.sessionData));

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Handle delete request to remove session data
   * @param request Incoming request
   * @returns Response confirming data was deleted
   */
  private async handleDelete(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');

    if (!key) {
      return new Response(JSON.stringify({
        error: 'Missing key'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete the value
    const deleted = this.sessionData.delete(key);
    
    // Persist to storage
    await this.state.storage.put('sessionData', Object.fromEntries(this.sessionData));

    return new Response(JSON.stringify({ deleted }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Handle clear request to remove all session data
   * @param request Incoming request
   * @returns Response confirming data was cleared
   */
  private async handleClear(request: Request): Promise<Response> {
    // Clear all data
    this.sessionData.clear();
    
    // Clear storage
    await this.state.storage.delete('sessionData');

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}