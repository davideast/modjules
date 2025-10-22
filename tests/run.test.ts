// tests/run.test.ts
import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { server } from './mocks/server.js';
import { Jules } from '../src/index.js';
import { http, HttpResponse } from 'msw';
import { SourceNotFoundError, RunFailedError } from '../src/errors.js';
import { Activity } from '../src/types.js';

// Set up the mock server
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const API_KEY = 'test-api-key';
const BASE_URL = 'https://jules.googleapis.com/v1alpha';
const MOCK_SESSION_ID = 'run-session-123';

const MOCK_RUN_CONFIG = {
  prompt: 'Add a dark mode toggle.',
  source: { github: 'davideast/dataprompt', branch: 'main' },
};

describe('jules.run()', () => {
  const jules = Jules({ apiKey: API_KEY, pollingInterval: 100 });

  beforeAll(() => {
    vi.useFakeTimers();
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  // Test for initial session setup and validation
  it('should throw SourceNotFoundError if the source cannot be resolved', async () => {
    await expect(
      jules.run({ ...MOCK_RUN_CONFIG, source: { github: 'non/existent', branch: 'main' } })
    ).rejects.toThrow(SourceNotFoundError);
  });

  // Test for correct session creation payload
  it('should create a session with correct parameters', async () => {
    let requestBody: any;
    server.use(
      http.post(`${BASE_URL}/sessions`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ id: MOCK_SESSION_ID });
      }),
      // Mock dependent calls to allow the run to complete cleanly
      http.get(`${BASE_URL}/sessions/${MOCK_SESSION_ID}/activities`, () => {
        return HttpResponse.json({
          activities: [{ name: 'a/1', sessionCompleted: {} }],
        });
      }),
      http.get(`${BASE_URL}/sessions/${MOCK_SESSION_ID}`, () => {
        return HttpResponse.json({ id: MOCK_SESSION_ID, state: 'completed', outputs: [] });
      })
    );

    const run = jules.run(MOCK_RUN_CONFIG);
    await vi.advanceTimersByTimeAsync(0); // Allow session creation to complete

    expect(requestBody.sourceContext.source).toBe('sources/github/davideast/dataprompt');
    expect(requestBody.requirePlanApproval).toBe(false);

    // Await the run to ensure all background activity completes
    await expect(run).resolves.toBeDefined();
  });

  // Test successful run: stream and final outcome
  it('should stream activities and resolve with the correct Outcome on success', async () => {
    server.use(
      http.post(`${BASE_URL}/sessions`, () => HttpResponse.json({ id: MOCK_SESSION_ID })),
      http.get(`${BASE_URL}/sessions/${MOCK_SESSION_ID}/activities`, () => {
        return HttpResponse.json({
          activities: [{ name: 'a/1', sessionCompleted: {} }],
        });
      }),
      http.get(`${BASE_URL}/sessions/${MOCK_SESSION_ID}`, () => {
        return HttpResponse.json({
          id: MOCK_SESSION_ID,
          state: 'completed',
          outputs: [{ pullRequest: { url: 'http://pr' } }],
        });
      })
    );

    const run = jules.run(MOCK_RUN_CONFIG);

    const streamedActivities: Activity[] = [];
    for await (const activity of run.stream()) {
      streamedActivities.push(activity);
    }

    const outcome = await run;

    expect(streamedActivities).toHaveLength(1);
    expect(streamedActivities[0].type).toBe('sessionCompleted');
    expect(outcome.state).toBe('completed');
    expect(outcome.pullRequest?.url).toBe('http://pr');
  });

  // Test failed run: stream and final outcome
  it('should stream activities and reject with RunFailedError on failure', async () => {
    server.use(
      http.post(`${BASE_URL}/sessions`, () => HttpResponse.json({ id: MOCK_SESSION_ID })),
      http.get(`${BASE_URL}/sessions/${MOCK_SESSION_ID}/activities`, () => {
        return HttpResponse.json({
          activities: [{ name: 'a/1', sessionFailed: { reason: 'API Error' } }],
        });
      }),
      http.get(`${BASE_URL}/sessions/${MOCK_SESSION_ID}`, () => {
        return HttpResponse.json({ id: MOCK_SESSION_ID, state: 'failed' });
      })
    );
    const run = jules.run(MOCK_RUN_CONFIG);
    const promise = expect(run).rejects.toThrow(RunFailedError);
    // Let's also check the stream
    const streamed: Activity[] = [];
    for await (const a of run.stream()) {
      streamed.push(a);
    }
    expect(streamed[0].type).toBe('sessionFailed');
    await promise;
  });

  // Critical test for the coordination/race condition
  it('should handle calling .stream() immediately before sessionId is available', async () => {
    // Mock session creation with a delay
    server.use(
      http.post(`${BASE_URL}/sessions`, async () => {
        await new Promise(r => setTimeout(r, 50)); // 50ms delay
        return HttpResponse.json({ id: MOCK_SESSION_ID });
      }),
      http.get(`${BASE_URL}/sessions/${MOCK_SESSION_ID}/activities`, () => {
        // Return a terminal activity to ensure the stream closes and the test doesn't time out.
        return HttpResponse.json({
          activities: [{ name: 'a/1', sessionCompleted: {} }],
        });
      })
    );

    const run = jules.run(MOCK_RUN_CONFIG);
    const stream = run.stream();

    const activities: Activity[] = [];
    const streamPromise = (async () => {
      for await (const activity of stream) {
        activities.push(activity);
      }
    })();

    // Advance timers to cover the session creation delay and allow the stream to process
    await vi.advanceTimersByTimeAsync(100);
    await streamPromise;

    expect(activities).toHaveLength(1);
    expect(activities[0].type).toBe('sessionCompleted');
  });
});
