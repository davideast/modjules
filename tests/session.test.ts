// tests/session.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from 'vitest';
import {
  Jules,
  JulesClient,
  SessionClient,
  AutomatedSessionFailedError,
  InvalidStateError,
  JulesError,
} from '../src/index.js';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// --- Mock API Server Setup ---
let capturedRequestBody: any;
let sendMessageBody: any;
let approvePlanCalled = false;

const server = setupServer(
  http.get(
    'https://jules.googleapis.com/v1alpha/sources/github/bobalover/boba-auth',
    () => {
      return HttpResponse.json({
        name: 'sources/github/bobalover/boba-auth',
        githubRepo: {},
      });
    },
  ),
  http.post(
    'https://jules.googleapis.com/v1alpha/sessions',
    async ({ request }) => {
      capturedRequestBody = await request.json();
      return HttpResponse.json({
        id: 'SESSION_123',
        name: 'sessions/SESSION_123',
        ...capturedRequestBody,
      });
    },
  ),
  // General session info endpoint
  http.get(
    'https://jules.googleapis.com/v1alpha/sessions/SESSION_123',
    ({ request }) => {
      return HttpResponse.json({
        id: 'SESSION_123',
        state: 'completed',
        outputs: [{ pullRequest: { url: 'http://pr.url' } }],
      });
    },
  ),
  // Specific endpoint for approve() state check
  http.get(
    'https://jules.googleapis.com/v1alpha/sessions/SESSION_APPROVE',
    () => {
      return HttpResponse.json({
        id: 'SESSION_APPROVE',
        state: 'awaitingPlanApproval',
      });
    },
  ),
  http.get(
    'https://jules.googleapis.com/v1alpha/sessions/SESSION_INVALID_STATE',
    () => {
      return HttpResponse.json({
        id: 'SESSION_INVALID_STATE',
        state: 'inProgress',
      });
    },
  ),
  http.post(
    'https://jules.googleapis.com/v1alpha/sessions/SESSION_APPROVE:approvePlan',
    async () => {
      approvePlanCalled = true;
      return HttpResponse.json({});
    },
  ),
  http.post(
    'https://jules.googleapis.com/v1alpha/sessions/SESSION_123:sendMessage',
    async ({ request }) => {
      sendMessageBody = await request.json();
      return HttpResponse.json({});
    },
  ),
  http.get('https://jules.googleapis.com/v1alpha/sessions/SESSION_FAIL', () => {
    return HttpResponse.json({
      id: 'SESSION_FAIL',
      state: 'failed',
      outputs: [],
    });
  }),
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  capturedRequestBody = undefined;
  sendMessageBody = undefined;
  approvePlanCalled = false;
  vi.useRealTimers();
});
afterAll(() => server.close());

describe('jules.session()', () => {
  let jules: JulesClient;

  beforeEach(() => {
    jules = Jules({ apiKey: 'test-key' });
  });

  it('should create a new session with correct defaults', async () => {
    const session = await jules.session({
      prompt: 'Refactor the auth flow.',
      source: { github: 'bobalover/boba-auth', branch: 'main' },
    });

    expect(session).toBeInstanceOf(Object);
    expect(session.id).toBe('SESSION_123');
    expect(capturedRequestBody).toBeDefined();
    expect(capturedRequestBody.requirePlanApproval).toBe(true);
  });

  it('should rehydrate a session from an ID without an API call', () => {
    const spy = vi.spyOn(global, 'fetch');
    const session = jules.session('EXISTING_SESSION');
    expect(session.id).toBe('EXISTING_SESSION');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('SessionClient', () => {
  let jules: JulesClient;
  let session: SessionClient;

  beforeEach(() => {
    jules = Jules({
      apiKey: 'test-key',
      config: { pollingIntervalMs: 10 },
    });
    session = jules.session('SESSION_123');
  });

  describe('waitFor()', () => {
    it('should resolve when the target state is reached', async () => {
      vi.useFakeTimers();
      let callCount = 0;
      server.use(
        http.get(
          'https://jules.googleapis.com/v1alpha/sessions/SESSION_123',
          () => {
            callCount++;
            const state = callCount > 1 ? 'awaitingPlanApproval' : 'inProgress';
            return HttpResponse.json({ id: 'SESSION_123', state });
          },
        ),
      );

      const waitForPromise = session.waitFor('awaitingPlanApproval');

      // The first call happens immediately, without waiting for the timer.
      // We need to wait for the promise to resolve to ensure the first fetch is done.
      await vi.advanceTimersByTimeAsync(1);
      expect(callCount).toBe(1);

      // Now, advance the timer to trigger the second poll.
      await vi.advanceTimersByTimeAsync(10);

      // Wait for the polling to complete.
      await waitForPromise;
      expect(callCount).toBe(2);
    });

    it('should resolve gracefully if the session terminates before the target state', async () => {
      server.use(
        http.get(
          'https://jules.googleapis.com/v1alpha/sessions/SESSION_123',
          () => {
            return HttpResponse.json({ id: 'SESSION_123', state: 'completed' });
          },
        ),
      );
      // This should not hang or throw
      await session.waitFor('awaitingPlanApproval');
    });
  });

  describe('approve()', () => {
    it('should make the approvePlan API call when state is correct', async () => {
      const approveSession = jules.session('SESSION_APPROVE');
      await approveSession.approve();
      expect(approvePlanCalled).toBe(true);
    });

    it('should throw InvalidStateError if state is not awaitingPlanApproval', async () => {
      const invalidStateSession = jules.session('SESSION_INVALID_STATE');
      await expect(invalidStateSession.approve()).rejects.toThrow(
        InvalidStateError,
      );
      expect(approvePlanCalled).toBe(false);
    });
  });

  describe('send()', () => {
    it('should make the sendMessage API call with the correct payload', async () => {
      await session.send('Make it corgi-themed.');
      expect(sendMessageBody).toBeDefined();
      expect(sendMessageBody.prompt).toBe('Make it corgi-themed.');
    });
  });

  describe('ask()', () => {
    it('should send a message and return the corresponding reply', async () => {
      vi.useFakeTimers();
      const startTime = new Date();

      server.use(
        http.get(
          'https://jules.googleapis.com/v1alpha/sessions/SESSION_123/activities',
          () => {
            return HttpResponse.json({
              activities: [
                {
                  name: 'a/1',
                  createTime: new Date(startTime.getTime() + 100).toISOString(),
                  agentMessaged: { agentMessage: 'Okay, I did it.' },
                },
                {
                  name: 'a/2',
                  createTime: new Date(startTime.getTime() + 200).toISOString(),
                  sessionCompleted: {},
                },
              ],
            });
          },
        ),
      );

      const reply = await session.ask('Did you update the CSS?');
      expect(sendMessageBody.prompt).toBe('Did you update the CSS?');
      expect(reply.type).toBe('agentMessaged');
      expect(reply.message).toBe('Okay, I did it.');
    });

    it('should filter out messages created before the ask was sent', async () => {
      vi.useFakeTimers();
      const testStartTime = new Date();
      vi.setSystemTime(testStartTime);

      // Set up the mock handler BEFORE calling ask().
      server.use(
        http.get(
          'https://jules.googleapis.com/v1alpha/sessions/SESSION_123/activities',
          () => {
            const replyTime = new Date(testStartTime.getTime() + 1); // Ensure this is after the ask() call
            return HttpResponse.json({
              activities: [
                {
                  name: 'a/0',
                  createTime: new Date(
                    testStartTime.getTime() - 1000,
                  ).toISOString(),
                  agentMessaged: { agentMessage: 'This is an old message.' },
                },
                {
                  name: 'a/1',
                  createTime: replyTime.toISOString(),
                  agentMessaged: { agentMessage: 'This is the new reply.' },
                },
                {
                  name: 'a/2',
                  createTime: new Date(replyTime.getTime() + 1).toISOString(),
                  sessionCompleted: {},
                },
              ],
            });
          },
        ),
      );

      const reply = await session.ask('Is this a new question?');

      expect(reply.message).toBe('This is the new reply.');
    });

    it('should throw an error if the session ends before a reply is received', async () => {
      server.use(
        http.get(
          'https://jules.googleapis.com/v1alpha/sessions/SESSION_123/activities',
          () => {
            return HttpResponse.json({
              activities: [{ name: 'a/1', sessionCompleted: {} }],
            });
          },
        ),
      );

      await expect(session.ask('Will you reply?')).rejects.toThrow(JulesError);
    });
  });

  it('result() should wait for completion and return the outcome', async () => {
    const outcome = await session.result();
    expect(outcome.state).toBe('completed');
    expect(outcome.pullRequest?.url).toBe('http://pr.url');
  });

  it('result() should throw RunFailedError on failure', async () => {
    const failedSession = jules.session('SESSION_FAIL');
    await expect(failedSession.result()).rejects.toThrow(
      AutomatedSessionFailedError,
    );
  });
});
