// tests/init.test.ts
import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest';
import { server } from './mocks/server.js';
import { Jules } from '../src/index.js';
import { MissingApiKeyError } from '../src/api.js';
import { JulesClientImpl } from '../src/client.js';

// Set up the mock server before all tests and clean up after
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('SDK Initialization', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original process.env after each test
    process.env = originalEnv;
  });

  it('should prioritize apiKey from options over environment variable', () => {
    process.env.JULES_API_KEY = 'env-var-key';
    const jules = Jules({ apiKey: 'option-key' }) as JulesClientImpl;
    // @ts-expect-error apiClient is private, but we access it for this test
    expect(jules.apiClient['apiKey']).toBe('option-key');
  });

  it('should read apiKey from JULES_API_KEY environment variable if not in options', () => {
    process.env.JULES_API_KEY = 'env-var-key';
    const jules = Jules() as JulesClientImpl;
     // @ts-expect-error apiClient is private, but we access it for this test
    expect(jules.apiClient['apiKey']).toBe('env-var-key');
  });

  it('should throw MissingApiKeyError if no apiKey is provided', async () => {
    // Ensure the env var is not set
    delete process.env.JULES_API_KEY;

    const jules = Jules(); // No API key provided

    // We expect the call to fail because the API key is missing
    await expect(
      jules.sources.get({ github: 'any/repo' })
    ).rejects.toThrow(MissingApiKeyError);
  });

  it('should use the default baseUrl if not provided', () => {
    const jules = Jules({ apiKey: 'test-key' }) as JulesClientImpl;
     // @ts-expect-error apiClient is private, but we access it for this test
    expect(jules.apiClient['baseUrl']).toBe('https://jules.googleapis.com/v1alpha');
  });

  it('should allow overriding the baseUrl', () => {
    const customUrl = 'http://localhost:8080';
    const jules = Jules({ apiKey: 'test-key', baseUrl: customUrl }) as JulesClientImpl;
     // @ts-expect-error apiClient is private, but we access it for this test
    expect(jules.apiClient['baseUrl']).toBe(customUrl);
  });
});
