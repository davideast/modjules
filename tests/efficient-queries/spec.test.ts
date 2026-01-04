import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as yaml from 'yaml';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getActivityCount } from '../../src/storage/cache-info.js';
import {
  NodeSessionStorage,
  NodeFileStorage,
} from '../../src/storage/node-fs.js';
import { Activity, SessionResource } from '../../src/types.js';

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

  for (const tc of efficientQueriesSpecCases) {
    it(tc.id, async () => {
      const rootDir = `tests/temp/${tc.id}`;
      await fs.mkdir(rootDir, { recursive: true });

      if (tc.when === 'getActivityCount') {
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
      }
    });
  }
});
