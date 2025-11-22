import { describe, vi, beforeEach, afterEach } from 'vitest';
import { NodePlatform } from '../../src/platform/node';
import { runPlatformTests } from './contract';

describe('NodePlatform', () => {
  // Mock global fetch
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url.includes('/json')) {
        return new Response(JSON.stringify({ slideshow: {} }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url.includes('/status/404')) {
        return new Response(null, { status: 404 });
      }
      return new Response(null, { status: 500 });
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  runPlatformTests('Node.js', new NodePlatform());
});
