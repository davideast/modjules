// tests/errors.test.ts
import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest';
import { server } from './mocks/server.js';
import { http, HttpResponse } from 'msw';
import { Jules } from '../src/index.js';
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
  const jules = Jules({ apiKey: TEST_API_KEY, baseUrl: TEST_BASE_URL });

  it('should throw JulesAuthenticationError on 401 Unauthorized', async () => {
    server.use(
      mockSourceLookup,
      http.post(`${TEST_BASE_URL}/sessions`, () => {
        return new HttpResponse(null, { status: 401 });
      }),
    );

    await expect(
      jules.session({
        prompt: 'test',
        source: { github: 'test/repo', branch: 'main' },
      }),
    ).rejects.toThrow(JulesAuthenticationError);
  });

  it('should throw JulesAuthenticationError on 403 Forbidden', async () => {
    server.use(
      mockSourceLookup,
      http.post(`${TEST_BASE_URL}/sessions`, () => {
        return new HttpResponse(null, { status: 403 });
      }),
    );

    await expect(
      jules.session({
        prompt: 'test',
        source: { github: 'test/repo', branch: 'main' },
      }),
    ).rejects.toThrow(JulesAuthenticationError);
  });

  it('should throw JulesRateLimitError on 429 Too Many Requests', async () => {
    server.use(
      mockSourceLookup,
      http.post(`${TEST_BASE_URL}/sessions`, () => {
        return new HttpResponse(null, { status: 429 });
      }),
    );

    await expect(
      jules.session({
        prompt: 'test',
        source: { github: 'test/repo', branch: 'main' },
      }),
    ).rejects.toThrow(JulesRateLimitError);
  });

  it('should throw JulesApiError on other non-2xx responses (e.g., 500)', async () => {
    server.use(
      mockSourceLookup,
      http.post(`${TEST_BASE_URL}/sessions`, () => {
        return new HttpResponse('Internal Server Error', { status: 500 });
      }),
    );

    await expect(
      jules.session({
        prompt: 'test',
        source: { github: 'test/repo', branch: 'main' },
      }),
    ).rejects.toThrow(JulesApiError);
  });

  it('should throw JulesNetworkError on fetch failure for session creation', async () => {
    server.use(
      mockSourceLookup,
      http.post(`${TEST_BASE_URL}/sessions`, () => {
        return HttpResponse.error(); // Force a network error
      }),
    );

    await expect(
      jules.session({
        prompt: 'test',
        source: { github: 'test/repo', branch: 'main' },
      }),
    ).rejects.toThrow(JulesNetworkError);
  });
});
