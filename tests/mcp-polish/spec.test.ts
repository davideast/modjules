import { toSummary } from '../../src/mcp/lightweight.js';
import { vi, describe, it, expect, beforeAll } from 'vitest';
import {
  ActivityAgentMessaged,
  ActivityProgressUpdated,
  ActivityUserMessaged,
  ActivitySessionFailed,
} from '../../src/types.js';
import { JulesMCPServer } from '../../src/mcp/server/index.js';
import { JulesClientImpl } from '../../src/client.js';
import {
  MemoryStorage,
  MemorySessionStorage,
} from '../../src/storage/memory.js';
import { mockPlatform } from '../mocks/platform.js';

const STUB_ACTIVITY_SESSION_FAILED: ActivitySessionFailed = {
  id: '6',
  name: 'session-failed',
  type: 'sessionFailed',
  reason: 'Something went wrong',
  createTime: new Date().toISOString(),
  originator: 'agent',
  artifacts: [],
};

describe('MCP Polish Specs', () => {
  describe('toSummary Edge Cases', () => {
    it('POLISH-01: Handles empty agent message', () => {
      const activity: ActivityAgentMessaged = {
        id: '1',
        name: 'agent-messaged',
        type: 'agentMessaged',
        message: '',
        createTime: new Date().toISOString(),
        originator: 'agent',
        artifacts: [],
      };
      const summary = toSummary(activity);
      expect(summary.summary).toBe('agentMessaged');
    });

    it('POLISH-02: Handles empty user message', () => {
      const activity: ActivityUserMessaged = {
        id: '2',
        name: 'user-messaged',
        type: 'userMessaged',
        message: '',
        createTime: new Date().toISOString(),
        originator: 'user',
        artifacts: [],
      };
      const summary = toSummary(activity);
      expect(summary.summary).toBe('userMessaged');
    });

    it('POLISH-03: Handles progress update with description only', () => {
      const activity: ActivityProgressUpdated = {
        id: '3',
        name: 'progress-updated',
        type: 'progressUpdated',
        description: 'Just a description',
        createTime: new Date().toISOString(),
        title: '',
        originator: 'agent',
        artifacts: [],
      };
      const summary = toSummary(activity);
      expect(summary.summary).toBe('Just a description');
    });

    it('POLISH-04: Handles progress update with title only', () => {
      const activity: ActivityProgressUpdated = {
        id: '4',
        name: 'progress-updated',
        type: 'progressUpdated',
        title: 'Just a title',
        createTime: new Date().toISOString(),
        description: '',
        originator: 'agent',
        artifacts: [],
      };
      const summary = toSummary(activity);
      expect(summary.summary).toBe('Just a title');
    });

    it('POLISH-05: Handles progress update with no title or description', () => {
      const activity: ActivityProgressUpdated = {
        id: '5',
        name: 'progress-updated',
        type: 'progressUpdated',
        createTime: new Date().toISOString(),
        title: '',
        description: '',
        originator: 'agent',
        artifacts: [],
      };
      const summary = toSummary(activity);
      expect(summary.summary).toBe('progressUpdated');
    });

    it('POLISH-06: Handles sessionFailed without a reason', () => {
      const activity = { ...STUB_ACTIVITY_SESSION_FAILED, reason: '' };
      const summary = toSummary(activity);
      expect(summary.summary).toBe('Session failed');
    });
  });

  describe('Tool and Schema Descriptions', () => {
    let server: JulesMCPServer;
    let tools: any[];

    beforeAll(async () => {
      const mockJulesClient = new JulesClientImpl(
        {
          apiKey: 'test-key',
          baseUrl: 'https://test.jules.com',
          config: { requestTimeoutMs: 1000 },
        },
        {
          activity: (sessionId: string) => new MemoryStorage(),
          session: () => new MemorySessionStorage(),
        },
        mockPlatform,
      );
      server = new JulesMCPServer(mockJulesClient);
      const toolListResponse = (server as any)._listTools();
      tools = toolListResponse.tools;
    });

    const getTool = (name: string) => {
      const tool = tools.find((t) => t.name === name);
      if (!tool) throw new Error(`Tool ${name} not found`);
      return tool;
    };

    it('POLISH-07: jules_select description is updated', () => {
      const tool = getTool('jules_select');
      expect(tool.description).toContain('LOCAL CACHE');
      expect(tool.description).toContain(
        'jules_session_timeline for fresh activity data',
      );
    });

    it('POLISH-08: jules_get_session_status description is updated', () => {
      const tool = getTool('jules_get_session_status');
      expect(tool.description).toMatch(/^\(DEPRECATED:/);
    });

    it('POLISH-09: jules_session_timeline type description is updated', () => {
      const tool = getTool('jules_session_timeline');
      const typeProp = tool.inputSchema.properties.type;
      expect(typeProp.description).toContain('Filter by activity type:');
      expect(typeProp.description).toContain('agentMessaged');
      expect(typeProp.description).toContain('sessionFailed');
    });

    it('POLISH-10: jules_session_state description is updated', () => {
      const tool = getTool('jules_session_state');
      expect(tool.description).toBe(
        'Returns lightweight session metadata (state, URL, PR info). Use jules_session_timeline for activities.',
      );
    });

    it('POLISH-11: sessionId descriptions are updated', () => {
      const checkDesc = (toolName: string) => {
        const tool = getTool(toolName);
        const sessionIdProp = tool.inputSchema.properties.sessionId;
        expect(sessionIdProp.description).toBe(
          'The session ID (numeric string)',
        );
      };
      checkDesc('jules_session_state');
      checkDesc('jules_session_timeline');
      checkDesc('jules_get_session_status');
    });

    it('POLISH-12: jules_session_timeline order description is updated', () => {
      const tool = getTool('jules_session_timeline');
      const orderProp = tool.inputSchema.properties.order;
      expect(orderProp.description).toBe(
        'Sort order: desc (newest first, default) or asc (oldest first)',
      );
    });
  });
});
