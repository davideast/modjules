// tests/init.test.ts
import { beforeAll, afterAll, afterEach, describe, it, expect, beforeEach } from 'vitest';
import { server } from './mocks/server.js';
import { Jules } from '../src/index.js';
import { JulesClientImpl } from '../src/client.js';
import { MissingApiKeyError } from '../src/errors.js';

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
    delete process.env.JULES_API_KEY;
    const jules = Jules();
    // Awaiting a method that requires the API key should throw the specific error
    await expect(
      jules.session({
        prompt: 'test',
        source: { github: 'test/repo', branch: 'main' },
      }),
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

describe('Configuration', () => {
  it('should apply default config values when none are provided', () => {
    const jules = Jules({ apiKey: 'test-key' }) as JulesClientImpl;
    // @ts-expect-error config is private, but we access it for this test
    const config = jules.config;
    expect(config.pollingIntervalMs).toBe(5000);
    expect(config.requestTimeoutMs).toBe(30000);

    // @ts-expect-error apiClient is private
    const apiClient = jules.apiClient;
    // @ts-expect-error requestTimeoutMs is private
    expect(apiClient.requestTimeoutMs).toBe(30000);
  });

  it('should allow overriding config values', () => {
    const jules = Jules({
      apiKey: 'test-key',
      config: {
        pollingIntervalMs: 1000,
        requestTimeoutMs: 10000,
      },
    }) as JulesClientImpl;

    // @ts-expect-error config is private
    const config = jules.config;
    expect(config.pollingIntervalMs).toBe(1000);
    expect(config.requestTimeoutMs).toBe(10000);

    // @ts-expect-error apiClient is private
    const apiClient = jules.apiClient;
    // @ts-expect-error requestTimeoutMs is private
    expect(apiClient.requestTimeoutMs).toBe(10000);
  });

  it('should only override the specified config value', () => {
    const jules = Jules({
      apiKey: 'test-key',
      config: {
        pollingIntervalMs: 9999,
      },
    }) as JulesClientImpl;
    // @ts-expect-error config is private
    const config = jules.config;
    expect(config.pollingIntervalMs).toBe(9999);
    expect(config.requestTimeoutMs).toBe(30000); // Should remain default
  });
});
