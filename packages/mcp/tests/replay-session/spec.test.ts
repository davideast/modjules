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

const SPEC_FILE = path.resolve(
  __dirname,
  '../../spec/replay-session/cases.yaml',
);

// #region Test Case Interfaces
interface BaseTestCase {
  id: string;
  description: string;
  category: string;
  status: 'pending' | 'implemented';
  priority: string;
}

interface ReplaySessionTestCase extends BaseTestCase {
  when: 'mcp_jules_replay_session';
  given: {
    sessionId: string;
    args: {
      cursor?: string;
    };
    activities: Array<{
      id: string;
      type: string;
      message?: string;
      plan?: { steps: Array<{ description: string }> };
      artifacts?: Array<{
        type: string;
        command?: string;
        stdout?: string;
        stderr?: string;
        exitCode?: number;
        source?: string;
        gitPatch?: {
          unidiffPatch: string;
        };
      }>;
    }>;
  };
  then: {
    result?: {
      step: {
        type: string;
        content?: any;
        command?: string;
        stdout?: string;
        stderr?: string;
        exitCode?: number;
        unidiffPatch?: string;
        originator?: string;
        attempt?: number;
        totalAttempts?: number;
      };
      progress: { current: number; total: number };
      nextCursor: string | null;
      prevCursor?: string | null;
      context?: {
        sessionId: string;
        title: string;
      } | null;
    };
    error?: string;
  };
}

type TestCase = ReplaySessionTestCase;
// #endregion

function createTestActivityWithArtifacts(input: {
  id: string;
  type: string;
  message?: string;
  plan?: { steps: Array<{ description: string }> };
  artifacts?: Array<{
    type: string;
    command?: string;
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    source?: string;
    gitPatch?: {
      unidiffPatch: string;
      baseCommitId?: string;
      suggestedCommitMessage?: string;
    };
  }>;
}): Activity {
  const artifacts = (input.artifacts || []).map((a) => {
    if (a.type === 'changeSet' && a.gitPatch) {
      return new ChangeSetArtifact(a.source || 'agent', {
        unidiffPatch: a.gitPatch.unidiffPatch,
        baseCommitId: a.gitPatch.baseCommitId || 'test-commit',
        suggestedCommitMessage:
          a.gitPatch.suggestedCommitMessage || 'Test commit message',
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
    createTime: new Date().toISOString(),
    originator: 'agent',
    artifacts,
    ...(input.message && { message: input.message }),
    ...(input.plan && { plan: input.plan }),
  } as Activity;
}

describe('Replay Session Spec', async () => {
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
      const mockSessionClient: Pick<SessionClient, 'activities' | 'info'> = {
        activities: {
          select: vi
            .fn()
            .mockResolvedValue(
              tc.given.activities.map(createTestActivityWithArtifacts),
            ),
          hydrate: vi.fn().mockResolvedValue(0),
        } as any,
        info: vi.fn().mockResolvedValue({
          id: tc.given.sessionId,
          name: `sessions/${tc.given.sessionId}`,
          title: 'Test Session',
          source: {
            name: 'sources/github/owner/repo',
            id: 'github/owner/repo',
            type: 'githubRepo',
            githubRepo: {
              owner: 'owner',
              repo: 'repo',
              isPrivate: false,
            },
          },
          prompt: '',
          sourceContext: {
            source: 'sources/github/owner/repo',
            githubRepoContext: {
              startingBranch: 'main',
            },
          },
          createTime: new Date().toISOString(),
          updateTime: new Date().toISOString(),
          state: 'completed',
          url: '',
          outputs: [],
        } as unknown as SessionResource),
      };

      vi.spyOn(mockJules, 'session').mockReturnValue(
        mockSessionClient as SessionClient,
      );

      if (tc.then.error) {
        await expect(
          (mcpServer as any).handleReplaySession({
            sessionId: tc.given.sessionId,
            ...tc.given.args,
          }),
        ).rejects.toThrow(tc.then.error);
        return;
      }

      const result = await (mcpServer as any).handleReplaySession({
        sessionId: tc.given.sessionId,
        ...tc.given.args,
      });
      const content = JSON.parse(result.content[0].text);
      const expected = tc.then.result;

      if (!expected) {
        throw new Error(`Test case ${tc.id} missing 'then.result' block.`);
      }

      // Assertions
      expect(content.step.type).toBe(expected.step.type);
      if (expected.step.content) {
        expect(content.step.content).toEqual(expected.step.content);
      }
      if (expected.step.command) {
        expect(content.step.command).toBe(expected.step.command);
        if (expected.step.attempt) {
          expect(content.step.attempt).toBe(expected.step.attempt);
          expect(content.step.totalAttempts).toBe(expected.step.totalAttempts);
        }
      }
      if (expected.step.unidiffPatch) {
        expect(content.step.unidiffPatch).toBe(expected.step.unidiffPatch);
      }

      expect(content.progress).toEqual(expected.progress);
      expect(content.nextCursor).toBe(expected.nextCursor);

      if (expected.prevCursor !== undefined) {
        expect(content.prevCursor).toBe(expected.prevCursor);
      }
      if (expected.context !== undefined) {
        expect(content.context).toEqual(expected.context);
      }
    });
  }
});
