import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserStorage } from '../../src/storage/browser.js';
import { Activity } from '../../src/types.js';
import 'fake-indexeddb/auto';
import { deleteDB } from 'idb';

describe('BrowserStorage', () => {
  let storage: BrowserStorage;
  const sessionId = 'test-session-456';

  beforeEach(async () => {
    // This is the most reliable way to reset state with fake-indexeddb
    await deleteDB('jules-activities');
    storage = new BrowserStorage(sessionId);
    await storage.init();
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
  });

  it('initializes successfully', async () => {
    // The init method should not throw
    expect(storage).toBeDefined();
  });

  it('scans an empty database gracefully', async () => {
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
      createTime: new Date('2023-01-01T10:00:00Z').toISOString(),
      originator: 'agent',
      artifacts: [],
    };
    const activity2: Activity = {
      id: 'act-2',
      type: 'userMessaged',
      message: 'Hi agent',
      name: 'sessions/s1/activities/act-2',
      createTime: new Date('2023-01-01T10:01:00Z').toISOString(),
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

  it('handles upserts correctly', async () => {
    const activity1: Activity = {
      id: 'act-1',
      type: 'agentMessaged',
      message: 'Original message',
      name: 'sessions/s1/activities/act-1',
      createTime: new Date().toISOString(),
      originator: 'agent',
      artifacts: [],
    };
    await storage.append(activity1);

    const updatedActivity1 = { ...activity1, message: 'Updated message' };
    await storage.append(updatedActivity1);

    const retrieved = await storage.get('act-1');
    expect(retrieved).toEqual(updatedActivity1);

    const scanned = [];
    for await (const act of storage.scan()) {
      scanned.push(act);
    }
    expect(scanned).toHaveLength(1);
  });
});
