import { describe, it, expect, beforeEach } from 'vitest';
import { XanoSessionManager } from '../xano-session-manager';
import { SmartError } from '../smart-error';

describe('Session Parameter Elimination', () => {
  let sessionManager: XanoSessionManager;
  const mockEnv = {
    OAUTH_KV: {
      get: async () => null,
      put: async () => {},
      delete: async () => {}
    }
  };
  const mockProps = {
    authenticated: true,
    sessionId: 'test-session'
  };

  beforeEach(async () => {
    sessionManager = new XanoSessionManager(mockEnv as any, mockProps);
    await sessionManager.initialize();
  });

  describe('Context Setting', () => {
    it('should set context with auto-completion', async () => {
      await sessionManager.setContext({
        instance_name: 'xnwv-v1z6-dvnr',
        workspace_id: 5
      });

      expect(sessionManager.getInstanceName()).toBe('xnwv-v1z6-dvnr.n7c.xano.io');
      expect(sessionManager.getWorkspaceId()).toBe(5);
    });

    it('should persist context across operations', async () => {
      await sessionManager.setContext({
        instance_name: 'xnwv-v1z6-dvnr',
        workspace_id: 5
      });

      // Simulate new session load
      const newSession = new XanoSessionManager(mockEnv as any, mockProps);
      await newSession.initialize();
      
      // Should load from KV
      expect(() => newSession.getInstanceName()).not.toThrow();
    });
  });

  describe('Parameter Injection', () => {
    it('should inject missing parameters from session', async () => {
      await sessionManager.setContext({
        instance_name: 'xnwv-v1z6-dvnr.n7c.xano.io',
        workspace_id: 5
      });

      const params = {};
      const enriched = sessionManager.enrichParams(params);

      expect(enriched.instance_name).toBe('xnwv-v1z6-dvnr.n7c.xano.io');
      expect(enriched.workspace_id).toBe(5);
    });

    it('should not override provided parameters', async () => {
      await sessionManager.setContext({
        instance_name: 'default.n7c.xano.io',
        workspace_id: 1
      });

      const params = {
        instance_name: 'specific.n7c.xano.io',
        workspace_id: 2
      };
      const enriched = sessionManager.enrichParams(params);

      expect(enriched.instance_name).toBe('specific.n7c.xano.io');
      expect(enriched.workspace_id).toBe(2);
    });
  });

  describe('Natural Language Resolution', () => {
    it('should resolve table names to IDs', async () => {
      sessionManager.cacheTable('users', 70);
      sessionManager.cacheTable('👤 users', 71);
      
      expect(sessionManager.resolveTableReference('users')).toBe(70);
      expect(sessionManager.resolveTableReference('👤 users')).toBe(71);
      expect(sessionManager.resolveTableReference(70)).toBe(70);
    });

    it('should handle emoji prefix stripping', async () => {
      sessionManager.cacheTable('👤 users', 71);
      
      // Should find without emoji
      expect(sessionManager.resolveTableReference('users', true)).toBe(71);
    });
  });

  describe('Error Enhancement', () => {
    it('should provide helpful context when no session set', () => {
      expect(() => sessionManager.getInstanceName()).toThrow(SmartError);
      
      try {
        sessionManager.getInstanceName();
      } catch (error) {
        expect(error).toBeInstanceOf(SmartError);
        expect((error as SmartError).suggestion).toContain('xano_set_context');
        expect((error as SmartError).example).toContain('instance_name');
      }
    });
  });
});