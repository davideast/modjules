import { JulesClientImpl, MemoryStorage, MemorySessionStorage } from 'modjules';
import type {
  Activity,
  JulesClient,
  SessionResource,
  SessionClient,
} from 'modjules';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import yaml from 'js-yaml';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { JulesMCPServer } from '../../src/server/index.js';
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

interface TimelineResultItem {
  id?: string;
  summary?: string;
  hasMessage?: boolean;
  hasArtifacts?: boolean;
  artifactCount?: number;
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
        items?: TimelineResultItem[];
      };
      hasMore: boolean;
      nextCursor?: string | null;
    };
  };
}

type TestCase = McpSessionStateTestCase | McpSessionTimelineTestCase;
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
        activity: () => new MemoryStorage(),
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
              hydrate: vi.fn().mockResolvedValue(0),
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
              const activity = content.activities[index];
              // Check static properties
              if (item.id) {
                expect(activity.id).toBe(item.id);
              }
              if (item.summary) {
                expect(activity.summary).toBe(item.summary);
              }
              if (item.artifactCount !== undefined) {
                expect(activity.artifactCount).toBe(item.artifactCount);
              }
              // Check boolean assertions
              if (item.hasMessage) {
                expect(activity).toHaveProperty('message');
                expect(activity.message).toBeDefined();
              }
              if (item.hasArtifacts) {
                expect(activity.artifacts).not.toBeNull();
                expect(Array.isArray(activity.artifacts)).toBe(true);
              }
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
      }
    });
  }
});
