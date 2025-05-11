export interface Env {
  // KV namespace for storing auth tokens
  AUTH_TOKENS: KVNamespace;
  
  // Durable Objects for session management
  SESSIONS: DurableObjectNamespace;
  
  // Environment variables
  XANO_API_BASE: string;
  XANO_CLIENT_ID: string;
  XANO_CLIENT_SECRET: string;
}