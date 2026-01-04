import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as yaml from 'yaml';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  getActivityCount,
  getSessionCount,
} from '../../src/storage/cache-info.js';
import {
  NodeSessionStorage,
  NodeFileStorage,
} from '../../src/storage/node-fs.js';
import { Activity, SessionResource } from '../../src/types.js';

// Mock fs/promises for EFF-02 O(1) verification
vi.mock('fs/promises', async () => {
  const actual =
    await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    readdir: vi.fn(actual.readdir),
  };
});

type TestCase = {
  id: string;
  description: string;
  category: string;
  status: 'pending' | 'implemented';
  testedIn?: string;
  given: any;
  when: string;
  then: any;
};

const specFile = await fs.readFile('spec/efficient-queries/cases.yaml', 'utf8');
const testCases = yaml.parse(specFile) as TestCase[];

describe('Efficient Queries Specs', () => {
  const efficientQueriesSpecCases = testCases.filter(
    (tc) =>
      tc.status === 'implemented' &&
      tc.testedIn?.includes('tests/efficient-queries/spec.test.ts'),
  );

  beforeEach(async () => {
    await fs.rm('tests/temp', { recursive: true, force: true });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await fs.rm('tests/temp', { recursive: true, force: true });
  });

  for (const tc of efficientQueriesSpecCases) {
    it(tc.id, async () => {
      const rootDir = `tests/temp/${tc.id}`;
      await fs.mkdir(rootDir, { recursive: true });

      if (tc.when === 'getActivityCount') {
        // EFF-01: Activity count without full scan
        const { sessionId, cachedActivities } = tc.given;
        const sessionStorage = new NodeSessionStorage(rootDir);
        const activityStorage = new NodeFileStorage(sessionId, rootDir);

        const mockSession: Partial<SessionResource> = {
          id: sessionId,
          title: 'Test Session',
          state: 'completed',
          createTime: new Date().toISOString(),
          sourceContext: { source: 'test' },
        };
        await sessionStorage.upsert(mockSession as SessionResource);

        for (let i = 0; i < cachedActivities; i++) {
          await activityStorage.append({
            id: `act-${i}`,
            type: 'userMessaged',
            message: 'hello',
          } as Activity);
        }

        const scanSpy = vi.spyOn(NodeFileStorage.prototype, 'scan');
        const count = await getActivityCount(sessionId, rootDir);

        expect(count).toBe(tc.then.result);

        if (
          tc.then.performance &&
          tc.then.performance.fullScanRequired === false
        ) {
          expect(scanSpy).not.toHaveBeenCalled();
        }
      } else if (tc.when === 'getSessionCount') {
        // EFF-02: Session count without full scan
        const cacheDir = path.join(rootDir, '.jules/cache');
        await fs.mkdir(cacheDir, { recursive: true });

        // Write global metadata file (O(1) read)
        const metadata = {
          lastSyncedAt: Date.now(),
          sessionCount: tc.given.cachedSessions,
        };
        await fs.writeFile(
          path.join(cacheDir, 'global-metadata.json'),
          JSON.stringify(metadata),
          'utf8',
        );

        // Clear mocks before the actual test call
        vi.mocked(fs.readdir).mockClear();

        const count = await getSessionCount(rootDir);
        expect(count).toBe(tc.then.result);

        // Verify O(1) - readdir NOT called when metadata exists
        if (
          tc.then.performance &&
          tc.then.performance.fullScanRequired === false
        ) {
          expect(vi.mocked(fs.readdir)).not.toHaveBeenCalled();
        }
      }
    });
  }
});
