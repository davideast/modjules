import {
  JulesClientImpl,
  MemoryStorage,
  MemorySessionStorage,
  ChangeSetArtifact,
  BashArtifact,
} from 'modjules';
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

interface McpGetCodeChangesTestCase extends BaseTestCase {
  when: 'mcp_jules_get_code_changes';
  given: {
    sessionId: string;
    args?: {
      activityId?: string;
      filePath?: string;
    };
    activities: Array<{
      id: string;
      type: string;
      createTime?: string;
      artifacts: Array<{
        type: string;
        source?: string;
        gitPatch?: {
          unidiffPatch: string;
        };
      }>;
    }>;
  };
  then: {
    result?: {
      sessionId: string;
      activityId?: string;
      filePath?: string;
      unidiffPatch?: string | { contains?: string; excludes?: string };
      files: {
        count: number;
        items?: Array<{
          path: string;
          changeType: 'created' | 'modified' | 'deleted';
          additions?: number;
          deletions?: number;
        }>;
      };
      summary?: {
        totalFiles: number;
        created?: number;
        modified?: number;
        deleted?: number;
      };
    };
    error?: string;
  };
}

interface McpGetBashOutputsTestCase extends BaseTestCase {
  when: 'mcp_jules_get_bash_outputs';
  given: {
    sessionId: string;
    activities: Array<{
      id: string;
      type: string;
      message?: string;
      artifacts: Array<{
        type: string;
        command?: string;
        stdout?: string;
        stderr?: string;
        exitCode?: number;
      }>;
    }>;
  };
  then: {
    result: {
      sessionId: string;
      outputs: {
        count: number;
        items?: Array<{
          command: string;
          stdout?: string;
          stderr?: string;
          exitCode: number;
          activityId?: string;
        }>;
      };
      summary: {
        totalCommands: number;
        succeeded: number;
        failed: number;
      };
    };
  };
}

interface McpSessionFilesTestCase extends BaseTestCase {
  when: 'mcp_jules_session_files';
  given: {
    sessionId: string;
    activities: Array<{
      id: string;
      type: string;
      artifacts: Array<{
        type: string;
        source?: string;
        gitPatch?: {
          unidiffPatch: string;
        };
      }>;
    }>;
  };
  then: {
    result: {
      sessionId: string;
      files: {
        count: number;
        items?: Array<{
          path: string;
          changeType: 'created' | 'modified' | 'deleted';
          activityIds: string[];
          additions?: number;
          deletions?: number;
        }>;
      };
      summary: {
        totalFiles: number;
        created: number;
        modified: number;
        deleted: number;
      };
    };
  };
}

type TestCase =
  | McpSessionStateTestCase
  | McpSessionTimelineTestCase
  | McpGetCodeChangesTestCase
  | McpGetBashOutputsTestCase
  | McpSessionFilesTestCase;
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

/**
 * Creates a test activity with properly structured artifacts.
 * For changeSet artifacts, creates ChangeSetArtifact instances with parsed() method.
 */
function createTestActivityWithArtifacts(input: {
  id: string;
  type: string;
  createTime?: string;
  message?: string;
  artifacts: Array<{
    type: string;
    source?: string;
    gitPatch?: {
      unidiffPatch: string;
    };
    command?: string;
    stdout?: string;
    stderr?: string;
    exitCode?: number;
  }>;
}): Activity {
  const artifacts = input.artifacts.map((a) => {
    if (a.type === 'changeSet' && a.gitPatch) {
      // Provide default values for required GitPatch fields
      const fullGitPatch = {
        unidiffPatch: a.gitPatch.unidiffPatch,
        baseCommitId: 'test-base-commit',
        suggestedCommitMessage: 'test commit message',
      };
      return new ChangeSetArtifact(a.source || 'agent', fullGitPatch);
    }
    if (a.type === 'bashOutput') {
      return new BashArtifact({
        command: a.command || '',
        stdout: a.stdout || '',
        stderr: a.stderr || '',
        exitCode: a.exitCode === undefined ? null : a.exitCode,
      });
    }
    return a;
  });

  return {
    id: input.id,
    name: `sessions/test/activities/${input.id}`,
    type: input.type as any,
    createTime: input.createTime || new Date().toISOString(),
    originator: 'agent',
    artifacts,
    ...(input.message && { message: input.message }),
  } as Activity;
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

        case 'mcp_jules_get_code_changes': {
          const mockGet = vi.fn().mockImplementation((id: string) => {
            const activity = tc.given.activities.find((a) => a.id === id);
            if (activity) {
              return Promise.resolve(createTestActivityWithArtifacts(activity));
            }
            return Promise.reject(new Error('Activity not found'));
          });

          const mockSessionClient: Pick<SessionClient, 'activities'> = {
            activities: {
              get: mockGet,
            } as any,
          };

          vi.spyOn(mockJules, 'session').mockReturnValue(
            mockSessionClient as SessionClient,
          );

          if (tc.then.error) {
            await expect(
              (mcpServer as any).handleGetCodeChanges({
                sessionId: tc.given.sessionId,
                ...(tc.given.args || {}),
              }),
            ).rejects.toThrow(tc.then.error);
            break;
          }

          const result = await (mcpServer as any).handleGetCodeChanges({
            sessionId: tc.given.sessionId,
            ...(tc.given.args || {}),
          });
          const content = JSON.parse(result.content[0].text);
          const expectedResult = tc.then.result;

          if (!expectedResult) {
            throw new Error(`Test case ${tc.id} missing 'then.result' block.`);
          }

          expect(content.sessionId).toBe(expectedResult.sessionId);
          if (expectedResult.activityId) {
            expect(content.activityId).toBe(expectedResult.activityId);
          }
          if (expectedResult.filePath) {
            expect(content.filePath).toBe(expectedResult.filePath);
          }

          // unidiffPatch assertions
          if (typeof expectedResult.unidiffPatch === 'string') {
            expect(content.unidiffPatch).toBe(expectedResult.unidiffPatch);
          } else if (expectedResult.unidiffPatch) {
            if (expectedResult.unidiffPatch.contains) {
              expect(content.unidiffPatch).toContain(
                expectedResult.unidiffPatch.contains,
              );
            }
            if (expectedResult.unidiffPatch.excludes) {
              expect(content.unidiffPatch).not.toContain(
                expectedResult.unidiffPatch.excludes,
              );
            }
          }

          // files assertions
          expect(content.files.length).toBe(expectedResult.files.count);
          if (expectedResult.files.items) {
            expectedResult.files.items.forEach((expectedFile, index) => {
              const actualFile = content.files[index];
              expect(actualFile.path).toBe(expectedFile.path);
              expect(actualFile.changeType).toBe(expectedFile.changeType);
              if (expectedFile.additions !== undefined) {
                expect(actualFile.additions).toBe(expectedFile.additions);
              }
              if (expectedFile.deletions !== undefined) {
                expect(actualFile.deletions).toBe(expectedFile.deletions);
              }
            });
          }

          // summary assertions
          if (expectedResult.summary) {
            expect(content.summary.totalFiles).toBe(
              expectedResult.summary.totalFiles,
            );
            if (expectedResult.summary.created !== undefined) {
              expect(content.summary.created).toBe(
                expectedResult.summary.created,
              );
            }
            if (expectedResult.summary.modified !== undefined) {
              expect(content.summary.modified).toBe(
                expectedResult.summary.modified,
              );
            }
            if (expectedResult.summary.deleted !== undefined) {
              expect(content.summary.deleted).toBe(
                expectedResult.summary.deleted,
              );
            }
          }
          break;
        }

        case 'mcp_jules_get_bash_outputs': {
          const mockSessionClient: Pick<SessionClient, 'activities'> = {
            activities: {
              hydrate: vi.fn().mockResolvedValue(0),
              select: vi
                .fn()
                .mockResolvedValue(
                  tc.given.activities.map((a) =>
                    createTestActivityWithArtifacts(a as any),
                  ),
                ),
            } as any,
          };

          vi.spyOn(mockJules, 'session').mockReturnValue(
            mockSessionClient as SessionClient,
          );

          const result = await (mcpServer as any).handleGetBashOutputs({
            sessionId: tc.given.sessionId,
          });
          const content = JSON.parse(result.content[0].text);

          expect(content.sessionId).toBe(tc.then.result.sessionId);
          expect(content.outputs.length).toBe(tc.then.result.outputs.count);

          if (tc.then.result.outputs.items) {
            tc.then.result.outputs.items.forEach((expected, index) => {
              const actual = content.outputs[index];
              expect(actual.command).toBe(expected.command);
              expect(actual.exitCode).toBe(expected.exitCode);
              if (expected.stdout) {
                expect(actual.stdout).toBe(expected.stdout);
              }
              if (expected.stderr) {
                expect(actual.stderr).toBe(expected.stderr);
              }
              if (expected.activityId) {
                expect(actual.activityId).toBe(expected.activityId);
              }
            });
          }

          expect(content.summary).toEqual(tc.then.result.summary);
          break;
        }
        case 'mcp_jules_session_files': {
          const mockSessionClient: Pick<SessionClient, 'activities'> = {
            activities: {
              hydrate: vi.fn().mockResolvedValue(0),
              select: vi
                .fn()
                .mockResolvedValue(
                  tc.given.activities.map((a) =>
                    createTestActivityWithArtifacts(a as any),
                  ),
                ),
            } as any,
          };

          vi.spyOn(mockJules, 'session').mockReturnValue(
            mockSessionClient as SessionClient,
          );

          const result = await (mcpServer as any).handleSessionFiles({
            sessionId: tc.given.sessionId,
          });
          const content = JSON.parse(result.content[0].text);
          const expectedResult = tc.then.result;

          expect(content.sessionId).toBe(expectedResult.sessionId);
          expect(content.files.length).toBe(expectedResult.files.count);

          if (expectedResult.files.items) {
            expectedResult.files.items.forEach((expectedFile, index) => {
              const actualFile = content.files[index];
              expect(actualFile.path).toBe(expectedFile.path);
              expect(actualFile.changeType).toBe(expectedFile.changeType);
              expect(actualFile.activityIds).toEqual(expectedFile.activityIds);
              if (expectedFile.additions !== undefined) {
                expect(actualFile.additions).toBe(expectedFile.additions);
              }
              if (expectedFile.deletions !== undefined) {
                expect(actualFile.deletions).toBe(expectedFile.deletions);
              }
            });
          }

          expect(content.summary).toEqual(expectedResult.summary);
          break;
        }
      }
    });
  }
});
