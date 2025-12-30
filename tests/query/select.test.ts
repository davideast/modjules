import { describe, it, expect, vi, beforeEach } from 'vitest';
import { select } from '../../src/query/select.js';
import {
  JulesClient,
  JulesQuery,
  SessionResource,
  Activity,
  ActivityAgentMessaged,
} from '../../src/types.js';

// Mock types
type MockSessionStorage = {
  scanIndex: () => AsyncIterableIterator<{
    id: string;
    title: string;
    state: string;
  }>;
  get: (id: string) => Promise<{ resource: SessionResource } | null>;
};

type MockActivityClient = {
  select: (options: any) => Promise<Activity[]>;
};

type MockSessionClient = {
  activities: MockActivityClient;
  info: () => Promise<SessionResource>;
};

type MockJulesClient = {
  storage: MockSessionStorage;
  session: (id: string) => MockSessionClient;
};

describe('Unified Query Engine (select)', () => {
  let mockClient: MockJulesClient;
  let sessions: SessionResource[];
  let activities: Record<string, Activity[]>;

  beforeEach(() => {
    // 1. Setup Data
    sessions = [
      {
        id: 'sess_1',
        name: 'sessions/sess_1',
        title: 'Fix Login',
        state: 'completed',
        prompt: 'Fix it',
        createTime: '2023-01-01T00:00:00Z',
        updateTime: '2023-01-01T01:00:00Z',
        url: 'http://jules/sess_1',
        outputs: [],
        sourceContext: { source: 'github/owner/repo' },
      },
      {
        id: 'sess_2',
        name: 'sessions/sess_2',
        title: 'Add Feature X',
        state: 'failed',
        prompt: 'Add X',
        createTime: '2023-01-02T00:00:00Z',
        updateTime: '2023-01-02T01:00:00Z',
        url: 'http://jules/sess_2',
        outputs: [],
        sourceContext: { source: 'github/owner/repo' },
      },
    ];

    activities = {
      sess_1: [
        {
          id: 'act_1_1',
          name: 'sessions/sess_1/activities/act_1_1',
          type: 'agentMessaged',
          message: 'Hello',
          createTime: '2023-01-01T00:00:01Z',
          originator: 'agent',
          artifacts: [],
        } as ActivityAgentMessaged,
      ],
      sess_2: [
        {
          id: 'act_2_1',
          name: 'sessions/sess_2/activities/act_2_1',
          type: 'sessionFailed',
          reason: 'Error',
          createTime: '2023-01-02T00:00:01Z',
          originator: 'system',
          artifacts: [],
        } as any,
      ],
    };

    // 2. Setup Mocks
    mockClient = {
      storage: {
        scanIndex: async function* () {
          for (const s of sessions) {
            yield { id: s.id, title: s.title, state: s.state };
          }
        },
        get: async (id: string) => {
          const found = sessions.find((s) => s.id === id);
          return found ? { resource: found } : null;
        },
      },
      session: (id: string) => ({
        activities: {
          select: async (options: any) => {
            // Simple mock filtering
            const acts = activities[id] || [];
            if (options.limit) return acts.slice(0, options.limit);
            if (options.type)
              return acts.filter((a) => a.type === options.type);
            return acts;
          },
        },
        info: async () => sessions.find((s) => s.id === id)!,
      }),
    };
  });

  describe('Querying Sessions', () => {
    it('should project specific fields', async () => {
      const results = await select(mockClient as any, {
        from: 'sessions',
        select: ['id', 'title'],
      });

      expect(results).toHaveLength(2);
      expect(Object.keys(results[0])).toEqual(['id', 'title']);
      expect(results[0].id).toBe('sess_1');
      expect((results[0] as any).state).toBeUndefined();
    });

    it('should filter by state (index optimization)', async () => {
      const results = await select(mockClient as any, {
        from: 'sessions',
        where: { state: 'failed' },
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('sess_2');
    });

    it('should filter by search (fuzzy)', async () => {
      const results = await select(mockClient as any, {
        from: 'sessions',
        where: { search: 'login' },
      });

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Fix Login');
    });

    it('should join activities', async () => {
      const results = await select(mockClient as any, {
        from: 'sessions',
        where: { id: 'sess_1' },
        include: {
          activities: true,
        },
      });

      expect(results).toHaveLength(1);
      const session = results[0] as any;
      expect(session.activities).toBeDefined();
      expect(session.activities).toHaveLength(1);
      expect(session.activities[0].message).toBe('Hello');
    });
  });

  describe('Querying Activities (Scatter-Gather)', () => {
    it('should find activities across all sessions', async () => {
      const results = await select(mockClient as any, {
        from: 'activities',
      });

      // Should find act_1_1 and act_2_1
      expect(results).toHaveLength(2);
    });

    it('should filter activities by type', async () => {
      const results = await select(mockClient as any, {
        from: 'activities',
        where: { type: 'sessionFailed' },
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('act_2_1');
    });

    it('should join parent session metadata', async () => {
      const results = await select(mockClient as any, {
        from: 'activities',
        where: { type: 'agentMessaged' },
        include: {
          session: { select: ['title'] },
        },
      });

      expect(results).toHaveLength(1);
      const act = results[0] as any;
      expect(act.session).toBeDefined();
      expect(act.session.title).toBe('Fix Login');
      expect(act.session.id).toBeUndefined(); // Projection check
    });

    it('should respect global limits', async () => {
      // Create 3 sessions with 1 activity each
      // ... (requires updating mock data, but simple limit check on existing data)
      const results = await select(mockClient as any, {
        from: 'activities',
        limit: 1,
      });

      expect(results).toHaveLength(1);
    });
  });
});
