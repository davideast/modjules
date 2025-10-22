// tests/run.test.ts
import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { server } from './mocks/server.js';
import { Jules } from '../src/index.js';
import { http, HttpResponse } from 'msw';
import { SourceNotFoundError, RunFailedError } from '../src/errors.js';

// Set up the mock server before all tests and clean up after
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const API_KEY = 'test-api-key';
const BASE_URL = 'https://jules.googleapis.com/v1alpha';

const MOCK_SESSION_ID = 'run-session-123';

const MOCK_RUN_CONFIG = {
  prompt: 'Add a dark mode toggle.',
  source: {
    github: 'davideast/dataprompt',
    branch: 'main',
  },
  autoPr: true,
};

describe('jules.run()', () => {
  const jules = Jules({ apiKey: API_KEY });

  // Use fake timers to control polling
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('should throw SourceNotFoundError if the source cannot be resolved', async () => {
    await expect(
      jules.run({
        ...MOCK_RUN_CONFIG,
        source: { github: 'non/existent', branch: 'main' },
      })
    ).rejects.toThrow(SourceNotFoundError);
  });

  it('should create a session with the correct parameters and default automation settings', async () => {
    let requestBody: any;

    server.use(
      http.post(`${BASE_URL}/sessions`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({
          name: `sessions/${MOCK_SESSION_ID}`,
          id: MOCK_SESSION_ID,
          state: 'queued',
        });
      })
    );

    // We don't await the run to complete, just to start
    const run = jules.run(MOCK_RUN_CONFIG);

    // Let the async part of run() execute
    await vi.advanceTimersByTimeAsync(0);

    expect(requestBody).toBeDefined();
    expect(requestBody.sourceContext.source).toBe('sources/github/davideast/dataprompt');
    expect(requestBody.sourceContext.githubRepoContext.startingBranch).toBe('main');
    expect(requestBody.automationMode).toBe('AUTO_CREATE_PR');
    expect(requestBody.requirePlanApproval).toBe(false);

    // This test only validates the initial POST, so we can let the run complete cleanly.
    await vi.advanceTimersToNextTimerAsync();
    await expect(run).resolves.toBeDefined();
  });


  it('should successfully complete a run, poll until "completed", and return the Outcome', async () => {
    let pollCount = 0;
    server.use(
      http.post(`${BASE_URL}/sessions`, () => {
        return HttpResponse.json({ id: MOCK_SESSION_ID, state: 'queued' });
      }),
      http.get(`${BASE_URL}/sessions/${MOCK_SESSION_ID}`, () => {
        pollCount++;
        if (pollCount === 1) {
          return HttpResponse.json({ id: MOCK_SESSION_ID, state: 'inProgress' });
        }
        return HttpResponse.json({
          id: MOCK_SESSION_ID,
          state: 'completed',
          title: 'Dark Mode Toggle',
          outputs: [{
            pullRequest: {
              url: 'https://github.com/davideast/dataprompt/pull/1',
              title: 'feat: Add dark mode toggle',
              description: 'This PR adds a dark mode toggle.',
            },
          }],
        });
      })
    );

    const runPromise = jules.run(MOCK_RUN_CONFIG);

    // Advance timers to trigger two polls (5s + 5s)
    await vi.advanceTimersByTimeAsync(10000);

    const outcome = await runPromise;

    expect(pollCount).toBe(2);
    expect(outcome.state).toBe('completed');
    expect(outcome.sessionId).toBe(MOCK_SESSION_ID);
    expect(outcome.pullRequest).toBeDefined();
    expect(outcome.pullRequest?.url).toContain('/pull/1');
  });

  it('should reject with RunFailedError if the session polls to a "failed" state', async () => {
    server.use(
      http.post(`${BASE_URL}/sessions`, () => {
        return HttpResponse.json({ id: MOCK_SESSION_ID, state: 'queued' });
      }),
      http.get(`${BASE_URL}/sessions/${MOCK_SESSION_ID}`, () => {
        return HttpResponse.json({ id: MOCK_SESSION_ID, state: 'failed' });
      })
    );

    const runPromise = jules.run(MOCK_RUN_CONFIG);

    // Attach a no-op catch handler to prevent the unhandled rejection warning
    runPromise.catch(() => {});

    // Advance timers to trigger the poll
    await vi.advanceTimersByTimeAsync(5000);

    await expect(runPromise).rejects.toThrow(RunFailedError);
  });

  it('should return a Run object which is a Promise and has a .stream() method', async () => {
    const run = jules.run(MOCK_RUN_CONFIG);

    // It should be a "thenable"
    expect(typeof run.then).toBe('function');

    // It should have the .stream() method
    expect(typeof run.stream).toBe('function');

    // The stream method should throw when called
    expect(() => run.stream()).toThrow('Streaming is not yet implemented');

    // Advance timers to allow the promise to resolve based on default mocks
    await vi.advanceTimersToNextTimerAsync();

    // The promise should eventually resolve because the default handlers mock a successful run
    await expect(run).resolves.toBeDefined();
  });
});
