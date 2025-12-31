// tests/errors.test.ts
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
import { http, HttpResponse } from 'msw';
import { jules as defaultJules } from '../src/index.js';
import {
  JulesAuthenticationError,
  JulesRateLimitError,
  JulesApiError,
  JulesNetworkError,
} from '../src/errors.js';

// Set up the mock server
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const TEST_API_KEY = 'test-key';
const TEST_BASE_URL = 'https://testhost/v1alpha';

// A default successful source mock to prevent unhandled request errors
const mockSourceLookup = http.get(
  `${TEST_BASE_URL}/sources/github/test/repo`,
  () => {
    return HttpResponse.json({
      name: 'sources/github/test/repo',
      id: 'github/test/repo',
      githubRepo: {
        owner: 'test',
        repo: 'repo',
        isPrivate: false,
      },
    });
  },
);

describe('Error Handling', () => {
  const jules = defaultJules.with({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
  });

  it('should throw JulesAuthenticationError on 401 Unauthorized', async () => {
    const expectedUrl = `${TEST_BASE_URL}/sessions`;
    server.use(
      mockSourceLookup,
      http.post(expectedUrl, () => {
        return new HttpResponse(null, {
          status: 401,
          statusText: 'Unauthorized',
        });
      }),
    );

    const promise = jules.session({
      prompt: 'test',
      source: { github: 'test/repo', branch: 'main' },
    });

    await expect(promise).rejects.toThrow(JulesAuthenticationError);
    await expect(promise).rejects.toHaveProperty('url', expectedUrl);
    await expect(promise).rejects.toHaveProperty('status', 401);
  });

  it('should throw JulesAuthenticationError on 403 Forbidden', async () => {
    const expectedUrl = `${TEST_BASE_URL}/sessions`;
    server.use(
      mockSourceLookup,
      http.post(expectedUrl, () => {
        return new HttpResponse(null, { status: 403, statusText: 'Forbidden' });
      }),
    );

    const promise = jules.session({
      prompt: 'test',
      source: { github: 'test/repo', branch: 'main' },
    });

    await expect(promise).rejects.toThrow(JulesAuthenticationError);
    await expect(promise).rejects.toHaveProperty('url', expectedUrl);
    await expect(promise).rejects.toHaveProperty('status', 403);
  });

  it('should throw JulesRateLimitError on 429 Too Many Requests', async () => {
    const expectedUrl = `${TEST_BASE_URL}/sessions`;
    server.use(
      mockSourceLookup,
      http.post(expectedUrl, () => {
        return new HttpResponse(null, {
          status: 429,
          statusText: 'Too Many Requests',
        });
      }),
    );

    // Use fake timers to fast-forward through retries
    vi.useFakeTimers();

    const promise = jules.session({
      prompt: 'test',
      source: { github: 'test/repo', branch: 'main' },
    });

    // Attach expectation before advancing timers
    const expectation = expect(promise).rejects.toThrow(JulesRateLimitError);

    // Advance time enough to cover 5 retries (approx 31s)
    await vi.advanceTimersByTimeAsync(100000);

    await expectation;
    await expect(promise).rejects.toHaveProperty('url', expectedUrl);
    await expect(promise).rejects.toHaveProperty('status', 429);

    vi.useRealTimers();
  });

  it('should throw JulesApiError on other non-2xx responses (e.g., 500)', async () => {
    const expectedUrl = `${TEST_BASE_URL}/sessions`;
    server.use(
      mockSourceLookup,
      http.post(expectedUrl, () => {
        return new HttpResponse('Internal Server Error', {
          status: 500,
          statusText: 'Internal Server Error',
        });
      }),
    );

    const promise = jules.session({
      prompt: 'test',
      source: { github: 'test/repo', branch: 'main' },
    });

    await expect(promise).rejects.toThrow(JulesApiError);
    await expect(promise).rejects.toHaveProperty('url', expectedUrl);
    await expect(promise).rejects.toHaveProperty('status', 500);
    await expect(promise).rejects.toSatisfy((e: JulesApiError) =>
      e.message.includes('Internal Server Error'),
    );
  });

  it('should throw JulesNetworkError on fetch failure for session creation', async () => {
    const expectedUrl = `${TEST_BASE_URL}/sessions`;
    server.use(
      mockSourceLookup,
      http.post(expectedUrl, () => {
        return HttpResponse.error(); // Force a network error
      }),
    );

    const promise = jules.session({
      prompt: 'test',
      source: { github: 'test/repo', branch: 'main' },
    });

    await expect(promise).rejects.toThrow(JulesNetworkError);
    await expect(promise).rejects.toHaveProperty('url', expectedUrl);
  });
});
