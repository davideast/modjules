import { JulesClientImpl } from '../../src/client.js';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import yaml from 'js-yaml';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Activity,
  JulesClient,
  SessionResource,
  SessionClient,
} from '../../src/index.js';
import { JulesMCPServer } from '../../src/mcp/server/index.js';
import {
  MemoryStorage,
  MemorySessionStorage,
} from '../../src/storage/memory.js';
import { mockPlatform } from '../mocks/platform.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPEC_FILE = path.resolve(__dirname, '../../spec/mcp-tools/cases.yaml');

// #region Test Case Interfaces
interface BaseTestCase {
  id: string;
  description: string;
  category: string;
  status: 'pending' | 'implemented';
  priority: string;
}

interface McpSessionStateTestCase extends BaseTestCase {
  when: 'mcp_jules_session_state';
  given: {
    sessionId: string;
    sessionResource: Partial<SessionResource>;
  };
  then: {
    result: {
      id: string;
      state: string;
      url?: string;
      title?: string;
      pr?: { url: string; title: string } | null;
    };
  };
}

interface McpSessionTimelineTestCase extends BaseTestCase {
  when: 'mcp_jules_session_timeline';
  given: {
    sessionId: string;
    args: {
      limit?: number;
      startAfter?: string;
      order?: 'asc' | 'desc';
      type?: string;
    };
    activities: Partial<Activity>[];
  };
  then: {
    result: {
      activities: {
        count: number;
        items?: Partial<Activity>[];
      };
      hasMore: boolean;
      nextCursor?: string | null;
    };
  };
}

interface McpGetSessionStatusTestCase extends BaseTestCase {
  when: 'mcp_jules_get_session_status';
  given: {
    sessionId: string;
    activityLimit: number;
    sessionResource: Partial<SessionResource>;
    activities: Partial<Activity>[];
  };
  then: {
    result: {
      state: string;
      url: string;
      recentActivities: {
        count: number;
        items?: Partial<Activity>[];
      };
    };
  };
}

type TestCase =
  | McpSessionStateTestCase
  | McpSessionTimelineTestCase
  | McpGetSessionStatusTestCase;
// #endregion

function createTestActivity(overrides: Partial<Activity> = {}): Activity {
  const defaults: Partial<Activity> = {
    id: 'test-id',
    name: 'sessions/test/activities/test-id',
    type: 'agentMessaged',
    createTime: new Date().toISOString(),
    originator: 'agent',
    artifacts: [],
    message: 'test message',
  };

  if (overrides.type === 'planGenerated') {
    (defaults as any).plan = { steps: [] };
  }

  return { ...defaults, ...overrides } as Activity;
}

async function* asyncGenerator<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) {
    yield item;
  }
}

describe('MCP Tools Spec', async () => {
  const specContent = await fs.readFile(SPEC_FILE, 'utf-8');
  const testCases = (yaml.load(specContent) as TestCase[]).filter(
    (c) => c.status === 'implemented',
  );

  let mockJules: JulesClient;
  let mcpServer: JulesMCPServer;

  beforeAll(() => {
    mockJules = new JulesClientImpl(
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
    mcpServer = new JulesMCPServer(mockJules);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  for (const tc of testCases) {
    it(`${tc.id}: ${tc.description}`, async () => {
      switch (tc.when) {
        case 'mcp_jules_session_state': {
          const mockSessionClient: Pick<SessionClient, 'info'> = {
            info: vi
              .fn()
              .mockResolvedValue(tc.given.sessionResource as SessionResource),
          };
          vi.spyOn(mockJules, 'session').mockReturnValue(
            mockSessionClient as SessionClient,
          );

          const result = await (mcpServer as any).handleSessionState({
            sessionId: tc.given.sessionId,
          });
          const content = JSON.parse(result.content[0].text);

          expect(content.id).toEqual(tc.then.result.id);
          expect(content.state).toEqual(tc.then.result.state);
          if (tc.then.result.url) {
            expect(content.url).toEqual(tc.then.result.url);
          }
          if (tc.then.result.title) {
            expect(content.title).toEqual(tc.then.result.title);
          }
          if (tc.then.result.pr) {
            expect(content.pr).toEqual(tc.then.result.pr);
          } else if (tc.then.result.pr === null) {
            expect(content.pr).toBeUndefined();
          }
          break;
        }

        case 'mcp_jules_session_timeline': {
          const mockSessionClient: Pick<SessionClient, 'activities'> = {
            activities: {
              select: vi
                .fn()
                .mockResolvedValue(tc.given.activities.map(createTestActivity)),
            } as any,
          };

          vi.spyOn(mockJules, 'session').mockReturnValue(
            mockSessionClient as SessionClient,
          );

          const result = await (mcpServer as any).handleSessionTimeline({
            sessionId: tc.given.sessionId,
            ...tc.given.args,
          });
          const content = JSON.parse(result.content[0].text);

          expect(mockSessionClient.activities.select).toHaveBeenCalledWith(
            expect.objectContaining({
              limit: (tc.given.args.limit || 10) + 1,
              after: tc.given.args.startAfter,
              order: tc.given.args.order || 'desc',
              type: tc.given.args.type,
            }),
          );

          expect(content.activities.length).toBe(
            tc.then.result.activities.count,
          );
          if (tc.then.result.activities.items) {
            tc.then.result.activities.items.forEach((item, index) => {
              expect(content.activities[index]).toEqual(
                expect.objectContaining(item),
              );
            });
          }
          expect(content.hasMore).toBe(tc.then.result.hasMore);
          if (tc.then.result.nextCursor) {
            expect(content.nextCursor).toBe(tc.then.result.nextCursor);
          } else if (tc.then.result.nextCursor === null) {
            expect(content.nextCursor).toBeUndefined();
          }
          break;
        }

        case 'mcp_jules_get_session_status': {
          const mockSessionClient: Pick<SessionClient, 'info' | 'history'> = {
            info: vi
              .fn()
              .mockResolvedValue(tc.given.sessionResource as SessionResource),
            history: vi
              .fn()
              .mockReturnValue(
                asyncGenerator(tc.given.activities.map(createTestActivity)),
              ),
          };
          vi.spyOn(mockJules, 'session').mockReturnValue(
            mockSessionClient as SessionClient,
          );

          const result = await (mcpServer as any).handleGetSessionStatus({
            sessionId: tc.given.sessionId,
            activityLimit: tc.given.activityLimit,
          });

          const content = JSON.parse(result.content[0].text);
          expect(content.state).toBe(tc.then.result.state);
          expect(content.url).toBe(tc.then.result.url);
          expect(content.recentActivities.length).toBe(
            tc.then.result.recentActivities.count,
          );
          if (tc.then.result.recentActivities.items) {
            tc.then.result.recentActivities.items.forEach((item, index) => {
              expect(content.recentActivities[index]).toEqual(
                expect.objectContaining(item),
              );
            });
          }
          break;
        }
      }
    });
  }
});
