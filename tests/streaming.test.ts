// tests/streaming.test.ts
import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { server } from './mocks/server.js';
import { http, HttpResponse } from 'msw';
import { ApiClient } from '../src/api.js';
import { streamActivities } from '../src/streaming.js';
import { Activity } from '../src/types.js';

// Set up the mock server
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const API_KEY = 'test-api-key';
const BASE_URL = 'https://jules.googleapis.com/v1alpha';
const SESSION_ID = 'stream-session-123';
const POLLING_INTERVAL = 1000; // Use a faster interval for tests

describe('streamActivities', () => {
  const apiClient = new ApiClient({ apiKey: API_KEY, baseUrl: BASE_URL });

  // Use fake timers to control polling
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  async function collectStream(stream: AsyncGenerator<Activity>): Promise<Activity[]> {
    const items: Activity[] = [];
    // Use a Promise to handle the async iteration
    const streamPromise = (async () => {
      for await (const item of stream) {
        items.push(item);
      }
    })();
    // Advance timers to allow the stream to process
    await vi.advanceTimersToNextTimerAsync();
    await streamPromise;
    return items;
  }

  it('should handle fast pagination with nextPageToken', async () => {
    const page1 = {
      activities: [
        { name: 'a/1', progressUpdated: { title: 'Page 1' } },
      ],
      nextPageToken: 'tokenA',
    };
    const page2 = {
      activities: [
        { name: 'a/2', progressUpdated: { title: 'Page 2' } },
        { name: 'a/3', sessionCompleted: {} },
      ],
    };

    server.use(
      http.get(`${BASE_URL}/sessions/${SESSION_ID}/activities`, ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get('pageToken');
        if (token === 'tokenA') {
          return HttpResponse.json(page2);
        }
        return HttpResponse.json(page1);
      })
    );

    const stream = streamActivities(SESSION_ID, apiClient, POLLING_INTERVAL);
    const activities = await collectStream(stream);

    expect(activities).toHaveLength(3);
    expect(activities[0].id).toBe('1');
    expect(activities[2].type).toBe('sessionCompleted');
  });

  it('should handle slow polling when no nextPageToken is present', async () => {
    let requestCount = 0;
    const page1 = {
      activities: [
        { name: 'a/1', progressUpdated: { title: 'First Batch' } },
      ],
      // No nextPageToken
    };
    const page2 = {
      activities: [{ name: 'a/2', sessionCompleted: {} }],
    };

    server.use(
      http.get(`${BASE_URL}/sessions/${SESSION_ID}/activities`, () => {
        requestCount++;
        if (requestCount > 1) {
          return HttpResponse.json(page2);
        }
        return HttpResponse.json(page1);
      })
    );

    const stream = streamActivities(SESSION_ID, apiClient, POLLING_INTERVAL);
    const items: Activity[] = [];

    const streamPromise = (async () => {
      for await (const item of stream) {
        items.push(item);
      }
    })();

    // Process the first batch
    await vi.advanceTimersByTimeAsync(0);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('1');

    // Advance time to trigger the poll
    await vi.advanceTimersByTimeAsync(POLLING_INTERVAL);

    // Wait for the stream to complete
    await streamPromise;

    expect(requestCount).toBe(2);
    expect(items).toHaveLength(2);
    expect(items[1].type).toBe('sessionCompleted');
  });

  it('should terminate immediately if a terminal activity is in the first batch', async () => {
    server.use(
      http.get(`${BASE_URL}/sessions/${SESSION_ID}/activities`, () => {
        return HttpResponse.json({
          activities: [{ name: 'a/1', sessionFailed: { reason: 'Failed' } }],
        });
      })
    );

    const stream = streamActivities(SESSION_ID, apiClient, POLLING_INTERVAL);
    const activities = await collectStream(stream);

    expect(activities).toHaveLength(1);
    expect(activities[0].type).toBe('sessionFailed');
  });
});
