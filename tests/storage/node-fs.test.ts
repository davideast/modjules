import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { NodeFileStorage } from '../../src/storage/node-fs.js';
import { Activity } from '../../src/types.js';

describe('NodeFileStorage', () => {
  let tmpDir: string;
  let storage: NodeFileStorage;
  const sessionId = 'test-session-123';

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jules-storage-test-'));
    storage = new NodeFileStorage(sessionId, tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('initializes successfully and creates directory structure', async () => {
    await storage.init();
    const cachePath = path.join(tmpDir, '.jules/cache', sessionId);
    const stats = await fs.stat(cachePath);
    expect(stats.isDirectory()).toBe(true);
  });

  it('scans an empty/non-existent file gracefully', async () => {
    const activities = [];
    for await (const act of storage.scan()) {
      activities.push(act);
    }
    expect(activities).toEqual([]);
  });

  it('appends and retrieves activities', async () => {
    const activity1: Activity = {
      id: 'act-1',
      type: 'agentMessaged',
      message: 'Hello world',
      name: 'sessions/s1/activities/act-1',
      createTime: new Date().toISOString(),
      originator: 'agent',
      artifacts: [],
    };
    const activity2: Activity = {
      id: 'act-2',
      type: 'userMessaged',
      message: 'Hi agent',
      name: 'sessions/s1/activities/act-2',
      createTime: new Date().toISOString(),
      originator: 'user',
      artifacts: [],
    };

    await storage.append(activity1);
    await storage.append(activity2);

    // Test get()
    const retrieved1 = await storage.get('act-1');
    expect(retrieved1).toEqual(activity1);
    const retrieved2 = await storage.get('act-2');
    expect(retrieved2).toEqual(activity2);
    const retrievedNone = await storage.get('act-none');
    expect(retrievedNone).toBeUndefined();

    // Test latest()
    const latest = await storage.latest();
    expect(latest).toEqual(activity2);

    // Test scan()
    const scanned = [];
    for await (const act of storage.scan()) {
      scanned.push(act);
    }
    expect(scanned).toHaveLength(2);
    expect(scanned[0]).toEqual(activity1);
    expect(scanned[1]).toEqual(activity2);
  });

  it('handles corrupt lines gracefully during scan', async () => {
    await storage.init();
    // Manually write some good and bad data
    const goodJson = JSON.stringify({
      id: 'good-1',
      type: 'sessionCompleted',
    } as any);
    const badLine = 'this is not json';
    const filePath = path.join(
      tmpDir,
      '.jules/cache',
      sessionId,
      'activities.jsonl',
    );

    await fs.appendFile(filePath, goodJson + '\n' + badLine + '\n', 'utf8');

    const scanned = [];
    for await (const act of storage.scan()) {
      scanned.push(act);
    }
    // Should have skipped the bad line and got the good one
    expect(scanned).toHaveLength(1);
    expect(scanned[0].id).toBe('good-1');
  });
});
