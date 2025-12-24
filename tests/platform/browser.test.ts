/**
 * @vitest-environment jsdom
 */
import { describe, vi, beforeEach, afterEach } from 'vitest';
import { BrowserPlatform } from '../../src/platform/browser';
import { runPlatformTests } from './contract';

describe('BrowserPlatform', () => {
  // Mock window.fetch
  const originalFetch = window.fetch;

  beforeEach(() => {
    window.fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        if (url.includes('/json')) {
          // jsdom's Response implementation
          return new Response(JSON.stringify({ slideshow: {} }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('/status/404')) {
          return new Response(null, { status: 404 });
        }
        return new Response(null, { status: 500 });
      },
    );
  });

  afterEach(() => {
    window.fetch = originalFetch;
  });

  runPlatformTests('Browser', new BrowserPlatform(), (key, value) => {
    // jsdom includes a process shim, so we can test the behavior
    process.env[key] = value;
  });
});
