// tests/automated_session.test.ts
import {
  beforeAll,
  afterAll,
  afterEach,
  describe,
  it,
  expect,
  vi,
} from 'vitest';
import { server } from './mocks/server.js';
import { jules as defaultJules } from '../src/index.js';
import { http, HttpResponse } from 'msw';
import {
  AutomatedSessionFailedError,
  SourceNotFoundError,
} from '../src/errors.js';
import { Activity } from '../src/types.js';

// Set up the mock server
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const API_KEY = 'test-api-key';
const BASE_URL = 'https://jules.googleapis.com/v1alpha';
const MOCK_SESSION_ID = 'run-session-123';

const MOCK_AUTOMATED_SESSION_CONFIG = {
  prompt: 'Add a dark mode toggle.',
  source: { github: 'davideast/dataprompt', branch: 'main' },
};

describe('jules.run()', () => {
  const jules = defaultJules.with({
    apiKey: API_KEY,
    config: { pollingIntervalMs: 100 },
  });

  beforeAll(() => {
    vi.useFakeTimers();
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  // Test for initial session setup and validation
  it('should throw SourceNotFoundError if the source cannot be resolved', async () => {
    await expect(
      jules.run({
        ...MOCK_AUTOMATED_SESSION_CONFIG,
        source: { github: 'non/existent', branch: 'main' },
      }),
    ).rejects.toThrow(SourceNotFoundError);
  });

  // Test for correct session creation payload
  it('should create a session with correct parameters', async () => {
    let requestBody: any;
    server.use(
      http.post(`${BASE_URL}/sessions`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({
          id: MOCK_SESSION_ID,
          name: `sessions/${MOCK_SESSION_ID}`,
        });
      }),
      // Mock dependent calls to allow the run to complete cleanly
      http.get(`${BASE_URL}/sessions/${MOCK_SESSION_ID}/activities`, () => {
        return HttpResponse.json({
          activities: [{ name: 'a/1', sessionCompleted: {} }],
        });
      }),
      http.get(`${BASE_URL}/sessions/${MOCK_SESSION_ID}`, () => {
        return HttpResponse.json({
          id: MOCK_SESSION_ID,
          state: 'completed',
          outputs: [],
        });
      }),
    );

    const automatedSession = await jules.run(MOCK_AUTOMATED_SESSION_CONFIG);
    await vi.advanceTimersByTimeAsync(0); // Allow session creation to complete

    expect(requestBody.sourceContext.source).toBe(
      'sources/github/davideast/dataprompt',
    );
    expect(requestBody.requirePlanApproval).toBe(false);

    // Await the automated session to ensure all background activity completes
    await expect(automatedSession.result()).resolves.toBeDefined();
  });

  // Critical tests for environmentVariablesEnabled feature
  describe('environmentVariablesEnabled', () => {
    it('should include environmentVariablesEnabled: true in the API payload when set', async () => {
      let requestBody: any;
      server.use(
        http.post(`${BASE_URL}/sessions`, async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json({
            id: MOCK_SESSION_ID,
            name: `sessions/${MOCK_SESSION_ID}`,
          });
        }),
        http.get(`${BASE_URL}/sessions/${MOCK_SESSION_ID}/activities`, () => {
          return HttpResponse.json({
            activities: [{ name: 'a/1', sessionCompleted: {} }],
          });
        }),
        http.get(`${BASE_URL}/sessions/${MOCK_SESSION_ID}`, () => {
          return HttpResponse.json({
            id: MOCK_SESSION_ID,
            state: 'completed',
            outputs: [],
          });
        }),
      );

      const automatedSession = await jules.run({
        prompt: 'Deploy with env vars',
        source: {
          github: 'davideast/dataprompt',
          branch: 'main',
          environmentVariablesEnabled: true,
        },
      });
      await vi.advanceTimersByTimeAsync(0);

      // environmentVariablesEnabled is at sourceContext level, NOT inside githubRepoContext
      expect(requestBody.sourceContext.environmentVariablesEnabled).toBe(true);

      await expect(automatedSession.result()).resolves.toBeDefined();
    });

    it('should include environmentVariablesEnabled: false in the API payload when explicitly set to false', async () => {
      let requestBody: any;
      server.use(
        http.post(`${BASE_URL}/sessions`, async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json({
            id: MOCK_SESSION_ID,
            name: `sessions/${MOCK_SESSION_ID}`,
          });
        }),
        http.get(`${BASE_URL}/sessions/${MOCK_SESSION_ID}/activities`, () => {
          return HttpResponse.json({
            activities: [{ name: 'a/1', sessionCompleted: {} }],
          });
        }),
        http.get(`${BASE_URL}/sessions/${MOCK_SESSION_ID}`, () => {
          return HttpResponse.json({
            id: MOCK_SESSION_ID,
            state: 'completed',
            outputs: [],
          });
        }),
      );

      const automatedSession = await jules.run({
        prompt: 'Deploy without env vars',
        source: {
          github: 'davideast/dataprompt',
          branch: 'main',
          environmentVariablesEnabled: false,
        },
      });
      await vi.advanceTimersByTimeAsync(0);

      // environmentVariablesEnabled is at sourceContext level, NOT inside githubRepoContext
      expect(requestBody.sourceContext.environmentVariablesEnabled).toBe(false);

      await expect(automatedSession.result()).resolves.toBeDefined();
    });

    it('should NOT include environmentVariablesEnabled in the API payload when not set', async () => {
      let requestBody: any;
      server.use(
        http.post(`${BASE_URL}/sessions`, async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json({
            id: MOCK_SESSION_ID,
            name: `sessions/${MOCK_SESSION_ID}`,
          });
        }),
        http.get(`${BASE_URL}/sessions/${MOCK_SESSION_ID}/activities`, () => {
          return HttpResponse.json({
            activities: [{ name: 'a/1', sessionCompleted: {} }],
          });
        }),
        http.get(`${BASE_URL}/sessions/${MOCK_SESSION_ID}`, () => {
          return HttpResponse.json({
            id: MOCK_SESSION_ID,
            state: 'completed',
            outputs: [],
          });
        }),
      );

      const automatedSession = await jules.run({
        prompt: 'Deploy with default env var behavior',
        source: {
          github: 'davideast/dataprompt',
          branch: 'main',
          // environmentVariablesEnabled intentionally NOT set
        },
      });
      await vi.advanceTimersByTimeAsync(0);

      // Verify the property is not present in the payload (at sourceContext level)
      expect(requestBody.sourceContext).not.toHaveProperty(
        'environmentVariablesEnabled',
      );

      await expect(automatedSession.result()).resolves.toBeDefined();
    });
  });

  // Test successful run: stream and final outcome
  it('should stream activities and resolve with the correct Outcome on success', async () => {
    server.use(
      http.post(`${BASE_URL}/sessions`, () =>
        HttpResponse.json({
          id: MOCK_SESSION_ID,
          name: `sessions/${MOCK_SESSION_ID}`,
        }),
      ),
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
      }),
    );

    const automatedSession = await jules.run(MOCK_AUTOMATED_SESSION_CONFIG);

    const iterator = automatedSession.stream()[Symbol.asyncIterator]();
    const { value: activity } = await iterator.next();
    await iterator.return!();

    const outcome = await automatedSession.result();

    expect(activity.type).toBe('sessionCompleted');
    expect(outcome.state).toBe('completed');
    expect(outcome.pullRequest?.url).toBe('http://pr');
  });

  // Test failed run: stream and final outcome
  it('should stream activities and reject with AutomatedSessionFailedError on failure', async () => {
    server.use(
      http.post(`${BASE_URL}/sessions`, () =>
        HttpResponse.json({
          id: MOCK_SESSION_ID,
          name: `sessions/${MOCK_SESSION_ID}`,
        }),
      ),
      http.get(`${BASE_URL}/sessions/${MOCK_SESSION_ID}/activities`, () => {
        return HttpResponse.json({
          activities: [{ name: 'a/1', sessionFailed: { reason: 'API Error' } }],
        });
      }),
      http.get(`${BASE_URL}/sessions/${MOCK_SESSION_ID}`, () => {
        return HttpResponse.json({ id: MOCK_SESSION_ID, state: 'failed' });
      }),
    );
    const automatedSession = await jules.run(MOCK_AUTOMATED_SESSION_CONFIG);
    const promise = expect(automatedSession.result()).rejects.toThrow(
      AutomatedSessionFailedError,
    );

    const iterator = automatedSession.stream()[Symbol.asyncIterator]();
    const { value: activity } = await iterator.next();
    await iterator.return!();

    expect(activity.type).toBe('sessionFailed');
    await promise;
  });

  // Critical test for ensuring stream works immediately
  it('should handle calling .stream() immediately after run resolves', async () => {
    server.use(
      http.post(`${BASE_URL}/sessions`, () => {
        return HttpResponse.json({
          id: MOCK_SESSION_ID,
          name: `sessions/${MOCK_SESSION_ID}`,
        });
      }),
      http.get(`${BASE_URL}/sessions/${MOCK_SESSION_ID}/activities`, () => {
        return HttpResponse.json({
          activities: [{ name: 'a/1', sessionCompleted: {} }],
        });
      }),
    );

    const automatedSession = await jules.run(MOCK_AUTOMATED_SESSION_CONFIG);
    const stream = automatedSession.stream();
    const iterator = stream[Symbol.asyncIterator]();

    // Advance timers to allow the stream to process
    await vi.advanceTimersByTimeAsync(100);
    const { value: activity } = await iterator.next();
    await iterator.return!();

    expect(activity.type).toBe('sessionCompleted');
  });
});
