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
import { mockPlatform } from '../mocks/platform.js';

// Import pure functions
import {
  getSessionState,
  getBashOutputs,
  getSessionFiles,
  getCodeChanges,
  getSchema,
  getQueryHelp,
  validateQuery,
} from '../../src/functions/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPEC_FILE = path.resolve(__dirname, '../../spec/functions/cases.yaml');

// #region Test Case Interfaces
interface BaseTestCase {
  id: string;
  description: string;
  status: 'pending' | 'implemented';
}

interface SessionStateTestCase extends BaseTestCase {
  when: 'getSessionState';
  given: {
    sessionId: string;
    sessionResource?: Partial<SessionResource>;
  };
  then: {
    result?: {
      id: string;
      state: string;
      url?: string;
      title?: string;
      pr?: { url: string; title: string };
    };
    error?: string;
  };
}

interface BashOutputsTestCase extends BaseTestCase {
  when: 'getBashOutputs';
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

interface SessionFilesTestCase extends BaseTestCase {
  when: 'getSessionFiles';
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
          changeType: string;
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

interface CodeChangesTestCase extends BaseTestCase {
  when: 'getCodeChanges';
  given: {
    sessionId: string;
    activityId: string;
    filePath?: string;
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
      activityId: string;
      filePath?: string;
      unidiffPatch?: string | { contains?: string };
      files: {
        count: number;
        items?: Array<{
          path: string;
          changeType: string;
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

interface SchemaTestCase extends BaseTestCase {
  when: 'getSchema';
  given: {
    domain: string;
    format: string;
  };
  then: {
    result: {
      format: string;
      hasContent?: boolean;
      contentContains?: string;
    };
  };
}

interface QueryHelpTestCase extends BaseTestCase {
  when: 'getQueryHelp';
  given: {
    topic: string | null;
  };
  then: {
    result: {
      contains: string;
    };
  };
}

interface ValidateQueryTestCase extends BaseTestCase {
  when: 'validateQuery';
  given: {
    query: unknown;
  };
  then: {
    result: {
      valid: boolean;
      errorsCount?: number;
      hasErrors?: boolean;
    };
  };
}

type TestCase =
  | SessionStateTestCase
  | BashOutputsTestCase
  | SessionFilesTestCase
  | CodeChangesTestCase
  | SchemaTestCase
  | QueryHelpTestCase
  | ValidateQueryTestCase;
// #endregion

/**
 * Creates a test activity with properly structured artifacts.
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
      return new ChangeSetArtifact(a.source || 'agent', {
        unidiffPatch: a.gitPatch.unidiffPatch,
        baseCommitId: 'test-commit',
        suggestedCommitMessage: 'Test commit message',
      });
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

describe('Pure Functions Spec', async () => {
  const specContent = await fs.readFile(SPEC_FILE, 'utf-8');
  const testCases = (yaml.load(specContent) as TestCase[]).filter(
    (c) => c.status === 'implemented',
  );

  let mockJules: JulesClient;

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
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  for (const tc of testCases) {
    it(`${tc.id}: ${tc.description}`, async () => {
      switch (tc.when) {
        case 'getSessionState': {
          if (tc.then.error) {
            await expect(
              getSessionState(mockJules, tc.given.sessionId),
            ).rejects.toThrow(tc.then.error);
            break;
          }

          const mockSessionClient: Pick<SessionClient, 'info'> = {
            info: vi
              .fn()
              .mockResolvedValue(tc.given.sessionResource as SessionResource),
          };
          vi.spyOn(mockJules, 'session').mockReturnValue(
            mockSessionClient as SessionClient,
          );

          const result = await getSessionState(mockJules, tc.given.sessionId);

          expect(result.id).toEqual(tc.then.result!.id);
          expect(result.state).toEqual(tc.then.result!.state);
          if (tc.then.result!.url) {
            expect(result.url).toEqual(tc.then.result!.url);
          }
          if (tc.then.result!.title) {
            expect(result.title).toEqual(tc.then.result!.title);
          }
          if (tc.then.result!.pr) {
            expect(result.pr).toEqual(tc.then.result!.pr);
          }
          break;
        }

        case 'getBashOutputs': {
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

          const result = await getBashOutputs(mockJules, tc.given.sessionId);

          expect(result.sessionId).toBe(tc.then.result.sessionId);
          expect(result.outputs.length).toBe(tc.then.result.outputs.count);

          if (tc.then.result.outputs.items) {
            tc.then.result.outputs.items.forEach((expected, index) => {
              const actual = result.outputs[index];
              expect(actual.command).toBe(expected.command);
              expect(actual.exitCode).toBe(expected.exitCode);
              if (expected.stdout) {
                expect(actual.stdout).toBe(expected.stdout);
              }
              if (expected.activityId) {
                expect(actual.activityId).toBe(expected.activityId);
              }
            });
          }

          expect(result.summary).toEqual(tc.then.result.summary);
          break;
        }

        case 'getSessionFiles': {
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

          const result = await getSessionFiles(mockJules, tc.given.sessionId);
          const expectedResult = tc.then.result;

          expect(result.sessionId).toBe(expectedResult.sessionId);
          expect(result.files.length).toBe(expectedResult.files.count);

          if (expectedResult.files.items) {
            expectedResult.files.items.forEach((expectedFile, index) => {
              const actualFile = result.files[index];
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

          expect(result.summary).toEqual(expectedResult.summary);
          break;
        }

        case 'getCodeChanges': {
          if (tc.then.error) {
            const mockGet = vi.fn().mockImplementation((id: string) => {
              const activity = tc.given.activities.find((a) => a.id === id);
              if (activity) {
                return Promise.resolve(
                  createTestActivityWithArtifacts(activity),
                );
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

            await expect(
              getCodeChanges(
                mockJules,
                tc.given.sessionId,
                tc.given.activityId,
                tc.given.filePath,
              ),
            ).rejects.toThrow(tc.then.error);
            break;
          }

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

          const result = await getCodeChanges(
            mockJules,
            tc.given.sessionId,
            tc.given.activityId,
            tc.given.filePath,
          );
          const expectedResult = tc.then.result!;

          expect(result.sessionId).toBe(expectedResult.sessionId);
          expect(result.activityId).toBe(expectedResult.activityId);

          // unidiffPatch assertions
          if (typeof expectedResult.unidiffPatch === 'string') {
            expect(result.unidiffPatch).toBe(expectedResult.unidiffPatch);
          } else if (expectedResult.unidiffPatch) {
            if (expectedResult.unidiffPatch.contains) {
              expect(result.unidiffPatch).toContain(
                expectedResult.unidiffPatch.contains,
              );
            }
          }

          expect(result.files.length).toBe(expectedResult.files.count);
          if (expectedResult.files.items) {
            expectedResult.files.items.forEach((expectedFile, index) => {
              const actualFile = result.files[index];
              expect(actualFile.path).toBe(expectedFile.path);
              expect(actualFile.changeType).toBe(expectedFile.changeType);
            });
          }
          break;
        }

        case 'getSchema': {
          const result = getSchema(
            tc.given.domain as any,
            tc.given.format as any,
          );

          expect(result.format).toBe(tc.then.result.format);
          if (tc.then.result.hasContent) {
            expect(result.content).toBeDefined();
          }
          if (tc.then.result.contentContains) {
            expect(String(result.content)).toContain(
              tc.then.result.contentContains,
            );
          }
          break;
        }

        case 'getQueryHelp': {
          const result = getQueryHelp(tc.given.topic as any);
          expect(result).toContain(tc.then.result.contains);
          break;
        }

        case 'validateQuery': {
          const result = validateQuery(tc.given.query);

          expect(result.valid).toBe(tc.then.result.valid);
          if (tc.then.result.errorsCount !== undefined) {
            expect(result.errors.length).toBe(tc.then.result.errorsCount);
          }
          if (tc.then.result.hasErrors) {
            expect(result.errors.length).toBeGreaterThan(0);
          }
          break;
        }
      }
    });
  }
});
