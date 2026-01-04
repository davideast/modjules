import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as yaml from 'yaml';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  getCacheInfo,
  getSessionCacheInfo,
} from '../../src/storage/cache-info.js';
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

const specFile = await fs.readFile('spec/cache-freshness/cases.yaml', 'utf8');
const testCases = yaml.parse(specFile) as TestCase[];

describe('Cache Freshness Specs', () => {
  const cacheSpecCases = testCases.filter(
    (tc) =>
      tc.status === 'implemented' &&
      tc.testedIn?.includes('tests/cache/spec.test.ts'),
  );

  beforeEach(async () => {
    await fs.rm('tests/temp', { recursive: true, force: true });
  });

  for (const tc of cacheSpecCases) {
    it(tc.id, async () => {
      // Mock storage
      const rootDir = `tests/temp/${tc.id}`;
      await fs.mkdir(rootDir, { recursive: true });

      if (tc.when === 'getCacheInfo') {
        const sessionStorage = new NodeSessionStorage(rootDir);
        if (tc.given.syncPerformed) {
          const mockSession: Partial<SessionResource> = {
            id: tc.given.sessionId,
            title: 'Test Session',
            state: 'completed',
            createTime: new Date().toISOString(),
            sourceContext: { source: 'test' },
          };
          await sessionStorage.upsert(mockSession as SessionResource);
        }
        const info = await getCacheInfo(rootDir);
        expect(info.lastSyncedAt).toBeInstanceOf(Date);
        if (tc.given.syncPerformed) {
          expect(info.lastSyncedAt.getTime()).toBeGreaterThan(0);
        } else {
          expect(info.lastSyncedAt.getTime()).toBe(0);
        }
      } else if (tc.when === 'getSessionCacheInfo') {
        const sessionStorage = new NodeSessionStorage(rootDir);
        const activityStorage = new NodeFileStorage(
          tc.given.sessionId,
          rootDir,
        );

        const mockSession: Partial<SessionResource> = {
          id: tc.given.sessionId,
          title: 'Test Session',
          state: 'completed',
          createTime: new Date().toISOString(),
          sourceContext: { source: 'test' },
        };
        await sessionStorage.upsert(mockSession as SessionResource);

        const activitiesToSync =
          tc.given.activitiesSynced ?? tc.given.cachedActivities ?? 0;
        for (let i = 0; i < activitiesToSync; i++) {
          await activityStorage.append({
            id: `act-${i}`,
            type: 'userMessaged',
            message: 'hello',
          } as Activity);
        }

        const scanSpy = vi.spyOn(activityStorage, 'scan');
        const info = await getSessionCacheInfo(tc.given.sessionId, rootDir);

        expect(info).not.toBeNull();
        expect(info?.sessionId).toBe(tc.given.sessionId);
        expect(info?.lastSyncedAt).toBeInstanceOf(Date);
        expect(info?.lastSyncedAt.getTime()).toBeGreaterThan(0);

        if (tc.then.result.activityCount) {
          expect(info?.activityCount).toBe(tc.then.result.activityCount);
        }

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
