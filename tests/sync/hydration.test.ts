// tests/sync/hydration.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JulesClientImpl } from '../../src/client.js';
import {
  MemoryStorage,
  MemorySessionStorage,
} from '../../src/storage/memory.js';
import { ApiClient } from '../../src/api.js';
import { mock, mockSession } from '../mocks/sync.js';
import { collectAsync } from '../../src/utils.js';
import { Activity, SessionResource, StorageFactory } from '../../src/types.js';
import { mockPlatform } from '../mocks/platform.js';

const specCases = {
  'HYD-PARTIAL-01': {
    description:
      'HYD-PARTIAL-01: Should resume an interrupted sync by only fetching new activities',
  },
  'HYD-PARTIAL-02': {
    description:
      'HYD-PARTIAL-02: Should download new activities created after an initial complete sync',
  },
  'HYD-PARTIAL-05': {
    description:
      'HYD-PARTIAL-05: Should perform a full hydration if the activity cache is empty',
  },
};

describe('Partial Hydration', () => {
  let client: JulesClientImpl;
  let sessionStorage: MemorySessionStorage;
  let activityStorageMap: Map<string, MemoryStorage>;
  let storageFactory: StorageFactory;

  beforeEach(() => {
    sessionStorage = new MemorySessionStorage();
    activityStorageMap = new Map<string, MemoryStorage>();

    storageFactory = {
      activity: (sessionId: string) => {
        if (!activityStorageMap.has(sessionId)) {
          activityStorageMap.set(sessionId, new MemoryStorage());
        }
        return activityStorageMap.get(sessionId)!;
      },
      session: () => sessionStorage,
    };

    client = new JulesClientImpl(
      {
        storageFactory,
        apiKey: 'test-key',
      },
      storageFactory,
      mockPlatform,
    );

    // Inject a base mock client
    (client as any).apiClient = mock([]);
  });

  it(specCases['HYD-PARTIAL-01'].description, async () => {
    const sessionId = 'hyd-partial-01';
    const existingActivities = [
      {
        name: `${sessionId}/activities/001`,
        id: '001',
        createTime: '2024-01-01T12:00:01.000Z',
      },
      {
        name: `${sessionId}/activities/002`,
        id: '002',
        createTime: '2024-01-01T12:00:02.000Z',
      },
    ] as Activity[];

    const serverActivities = [
      ...existingActivities,
      {
        name: `${sessionId}/activities/003`,
        id: '003',
        createTime: '2024-01-01T12:00:03.000Z',
      },
      {
        name: `${sessionId}/activities/004`,
        id: '004',
        createTime: '2024-01-01T12:00:04.000Z',
      },
    ].reverse(); // history() returns newest first

    // Setup: Pre-populate storage with 2 activities
    const activityStorage = storageFactory.activity(sessionId);
    await sessionStorage.writeActivities(sessionId, existingActivities);
    const sessionResource = mockSession({ id: sessionId });
    await sessionStorage.upsert(sessionResource);
    await sessionStorage.updateSessionIndex(sessionId, {
      activityCount: 2,
      activityHighWaterMark: '2024-01-01T12:00:02.000Z',
    });

    (client as any).apiClient = mock([
      {
        pattern: /sessions\?/,
        data: { sessions: [sessionResource], nextPageToken: null },
      },
      {
        pattern: `sessions/${sessionId}/activities`,
        data: { activities: serverActivities },
      },
    ]);

    // Action: Run sync
    const stats = await client.sync({ depth: 'activities' });

    // Assertions
    expect(stats.activitiesIngested).toBe(2);

    const cachedActivities = await collectAsync(activityStorage.scan());

    expect(cachedActivities.length).toBe(4);
    expect(cachedActivities.map((a: Activity) => a.name)).toEqual([
      `${sessionId}/activities/001`,
      `${sessionId}/activities/002`,
      `${sessionId}/activities/003`,
      `${sessionId}/activities/004`,
    ]);

    const indexEntry = await sessionStorage.getSessionIndexEntry(sessionId);
    expect(indexEntry?.activityCount).toBe(4);
    expect(indexEntry?.activityHighWaterMark).toBe('2024-01-01T12:00:04.000Z');
  });

  it(specCases['HYD-PARTIAL-02'].description, async () => {
    const sessionId = 'hyd-partial-02';
    const initialActivities = [
      {
        name: `${sessionId}/activities/001`,
        id: '001',
        createTime: '2024-01-01T12:00:01.000Z',
      },
      {
        name: `${sessionId}/activities/002`,
        id: '002',
        createTime: '2024-01-01T12:00:02.000Z',
      },
    ].reverse() as Activity[];

    const newActivities = [
      {
        name: `${sessionId}/activities/003`,
        id: '003',
        createTime: '2024-01-01T12:00:03.000Z',
      },
    ].reverse() as Activity[];

    const sessionResource = mockSession({ id: sessionId });

    // Initial Sync
    (client as any).apiClient = mock([
      {
        pattern: /sessions\?/,
        data: { sessions: [sessionResource], nextPageToken: null },
      },
      {
        pattern: `sessions/${sessionId}/activities`,
        data: { activities: initialActivities },
      },
    ]);
    await client.sync({ depth: 'activities' });

    const activityStorage = storageFactory.activity(sessionId);
    let cached = await collectAsync(activityStorage.scan());
    expect(cached.length).toBe(2);

    // Subsequent Sync
    (client as any).apiClient = mock([
      {
        pattern: /sessions\?/,
        data: { sessions: [sessionResource], nextPageToken: null },
      },
      {
        pattern: `sessions/${sessionId}/activities`,
        data: { activities: [...newActivities, ...initialActivities] },
      },
    ]);
    const stats = await client.sync({ depth: 'activities' });

    expect(stats.activitiesIngested).toBe(1);
    cached = await collectAsync(activityStorage.scan());
    expect(cached.length).toBe(3);
    const indexEntry = await sessionStorage.getSessionIndexEntry(sessionId);
    expect(indexEntry?.activityCount).toBe(3);
    expect(indexEntry?.activityHighWaterMark).toBe('2024-01-01T12:00:03.000Z');
  });

  it(specCases['HYD-PARTIAL-05'].description, async () => {
    const sessionId = 'hyd-partial-05';
    const serverActivities = [
      {
        name: `${sessionId}/activities/001`,
        id: '001',
        createTime: '2024-01-01T12:00:01.000Z',
      },
      {
        name: `${sessionId}/activities/002`,
        id: '002',
        createTime: '2024-01-01T12:00:02.000Z',
      },
    ].reverse() as Activity[];
    const sessionResource = mockSession({ id: sessionId });
    await sessionStorage.upsert(sessionResource);

    (client as any).apiClient = mock([
      {
        pattern: /sessions\?/,
        data: { sessions: [sessionResource], nextPageToken: null },
      },
      {
        pattern: `sessions/${sessionId}/activities`,
        data: { activities: serverActivities },
      },
    ]);

    const stats = await client.sync({ depth: 'activities' });

    expect(stats.activitiesIngested).toBe(2);
    const activityStorage = storageFactory.activity(sessionId);
    const cached = await collectAsync(activityStorage.scan());
    expect(cached.length).toBe(2);
    const indexEntry = await sessionStorage.getSessionIndexEntry(sessionId);
    expect(indexEntry?.activityCount).toBe(2);
    expect(indexEntry?.activityHighWaterMark).toBe('2024-01-01T12:00:02.000Z');
  });
});
