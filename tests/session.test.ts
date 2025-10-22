// tests/session.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Jules, JulesClient, SessionClient, RunFailedError } from '../src/index';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// --- Mock API Server Setup ---
let capturedRequestBody: any;

const server = setupServer(
  http.get('https://jules.googleapis.com/v1alpha/sources/github/bobalover/boba-auth', () => {
    return HttpResponse.json({
      name: 'sources/github/bobalover/boba-auth',
      githubRepo: {},
    });
  }),
  http.post('https://jules.googleapis.com/v1alpha/sessions', async ({ request }) => {
    capturedRequestBody = await request.json();
    return HttpResponse.json({ id: 'SESSION_123', ...capturedRequestBody });
  }),
  http.get('https://jules.googleapis.com/v1alpha/sessions/SESSION_123', ({ request }) => {
    return HttpResponse.json({
      id: 'SESSION_123',
      state: 'completed',
      outputs: [{ type: 'pullRequest', pullRequest: { url: 'http://pr.url' } }],
    });
  }),
  http.get('https://jules.googleapis.com/v1alpha/sessions/SESSION_FAIL/activities', () => {
    return HttpResponse.json({
      activities: [{ name: 'a/1', sessionFailed: { reason: 'It broke' } }],
    });
  }),
  http.get('https://jules.googleapis.com/v1alpha/sessions/SESSION_FAIL', () => {
    return HttpResponse.json({ id: 'SESSION_FAIL', state: 'failed', outputs: [] });
  }),
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  capturedRequestBody = undefined;
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
    expect(capturedRequestBody.automationMode).toBe('AUTOMATION_MODE_UNSPECIFIED');
  });

  it('should allow overriding defaults', async () => {
    await jules.session({
      prompt: 'Refactor',
      source: { github: 'bobalover/boba-auth', branch: 'main' },
      requireApproval: false,
    });

    expect(capturedRequestBody).toBeDefined();
    expect(capturedRequestBody.requirePlanApproval).toBe(false);
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
  let session: SessionClient;

  beforeEach(() => {
    const jules = Jules({ apiKey: 'test-key', pollingInterval: 10 });
    session = jules.session('SESSION_123');
  });

  it('info() should fetch the session resource', async () => {
    const info = await session.info();
    expect(info.id).toBe('SESSION_123');
    expect(info.state).toBe('completed');
  });

  it('stream() should yield activities', async () => {
    server.use(
      http.get('https://jules.googleapis.com/v1alpha/sessions/SESSION_123/activities', () => {
        return HttpResponse.json({
          activities: [
            { name: 'a/1', agentMessaged: { agentMessage: 'Hello' } },
            { name: 'a/2', sessionCompleted: {} },
          ],
        });
      }),
    );

    const activities = [];
    for await (const activity of session.stream()) {
      activities.push(activity);
    }
    expect(activities).toHaveLength(2);
    expect(activities[0].type).toBe('agentMessaged');
  });

  it('result() should wait for completion and return the outcome', async () => {
    const outcome = await session.result();
    expect(outcome.state).toBe('completed');
    expect(outcome.pullRequest?.url).toBe('http://pr.url');
  });

  it('result() should throw RunFailedError on failure', async () => {
    const failedSession = Jules().session('SESSION_FAIL');
    await expect(failedSession.result()).rejects.toThrow(RunFailedError);
  });

  it('stubbed methods should throw "Not Implemented" errors', async () => {
    await expect(session.approve()).rejects.toThrow('Not Implemented');
    await expect(session.send('hi')).rejects.toThrow('Not Implemented');
    await expect(session.ask('hi')).rejects.toThrow('Not Implemented');
    await expect(session.waitFor('completed')).rejects.toThrow('Not Implemented');
  });
});
