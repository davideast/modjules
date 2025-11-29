/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from 'vitest';
import { BrowserPlatform } from '../../src/platform/browser';

describe('BrowserPlatform - Environment Fallback', () => {
  const platform = new BrowserPlatform();

  afterEach(() => {
    // Clean up
    if ((window as any).__MODJULES__) {
      delete (window as any).__MODJULES__;
    }
  });

  it('should read from window.__MODJULES__ if process.env is missing', () => {
    // Setup fallback
    (window as any).__MODJULES__ = {
      TEST_KEY: 'fallback-value',
    };

    // Ensure process.env doesn't have it
    if (typeof process !== 'undefined' && process.env) {
      delete process.env.TEST_KEY;
    }

    const value = platform.getEnv('TEST_KEY');
    expect(value).toBe('fallback-value');
  });

  it('should prioritize process.env over window.__MODJULES__', () => {
    // Setup both
    (window as any).__MODJULES__ = {
      TEST_KEY: 'fallback-value',
    };

    // We assume JSDOM environment has process
    if (typeof process !== 'undefined' && process.env) {
      process.env.TEST_KEY = 'process-value';
    } else {
      // If no process in test env, this test might not be meaningful for precedence,
      // but verify fallback still works?
      // We'll skip or just warn? JSDOM should have it.
    }

    const value = platform.getEnv('TEST_KEY');
    // If process exists, it should match process-value.
    // If not, it falls back (but we expect process in JSDOM).
    if (typeof process !== 'undefined') {
      expect(value).toBe('process-value');
    }

    // Cleanup
    if (typeof process !== 'undefined' && process.env) {
      delete process.env.TEST_KEY;
    }
  });
});
// test
