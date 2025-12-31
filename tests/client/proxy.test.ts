import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { connect } from '../../src/browser.js';

describe('Smart Proxy Client', () => {
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    mockFetch.mockReset();
    vi.useFakeTimers();
    vi.stubEnv('JULES_API_KEY', ''); // Ensure no API key leak
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('performs handshake before request', async () => {
    // Mock Sequence:
    // 1. Handshake Response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, token: 'cap_token_1' }),
      text: async () => JSON.stringify({ success: true, token: 'cap_token_1' }),
    } as Response);
    // 2. Actual API Response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ id: 'sess_123' }),
      json: async () => ({ id: 'sess_123' }),
    } as Response);

    const client = connect({
      proxy: { url: 'https://proxy.com', auth: () => 'firebase_id' },
    });

    await client.session('123').info();

    // Verify Handshake
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://proxy.com',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('authToken'),
      }),
    );

    // Verify Request with Token
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('path=%2Fsessions%2F123'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer cap_token_1',
        }),
      }),
    );
  });

  it('retries on 401 (Refresh Token)', async () => {
    const client = connect({
      proxy: { url: 'https://proxy.com', auth: () => 'auth' },
    });

    // Mock Sequence:
    // 1. Handshake 1 (Success)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, token: 'token_1' }),
      text: async () => JSON.stringify({ success: true, token: 'token_1' }),
    } as Response);
    // 2. API Call (Fail - Expired)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Expired',
      json: async () => ({ error: 'Expired' }),
    } as Response);
    // 3. Handshake 2 (Success)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, token: 'token_2' }),
      text: async () => JSON.stringify({ success: true, token: 'token_2' }),
    } as Response);
    // 4. API Call Retry (Success)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ id: 'sess_123' }),
      json: async () => ({ id: 'sess_123' }),
    } as Response);

    await client.session('123').info();

    expect(mockFetch).toHaveBeenCalledTimes(4);
    // Ensure final call used new token
    expect(mockFetch).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token_2',
        }),
      }),
    );
  });

  it('uses environment variables for configuration', async () => {
    vi.stubEnv('NEXT_PUBLIC_JULES_PROXY', 'https://env-proxy.com');
    vi.stubEnv('NEXT_PUBLIC_JULES_SECRET', 'env-secret');

    // Need to reset modules or something if env loading happens at import time?
    // No, it happens in constructor/factory.

    const client = connect(); // No config passed

    // Mock Handshake
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, token: 'token_env' }),
      text: async () => JSON.stringify({ success: true, token: 'token_env' }),
    } as Response);

    // Mock API Call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ id: 'sess_env' }),
      json: async () => ({ id: 'sess_env' }),
    } as Response);

    await client.session('123').info();

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://env-proxy.com',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('deduplicates concurrent handshake requests (thundering herd)', async () => {
    const client = connect({
      proxy: { url: 'https://proxy.com', auth: () => 'auth' },
    });

    // We want to simulate a slow handshake to ensure both requests await the same promise
    let resolveHandshake: (value: any) => void;
    const handshakePromise = new Promise((resolve) => {
      resolveHandshake = resolve;
    });

    // Mock Handshake (Only called once)
    mockFetch.mockReturnValueOnce(handshakePromise);

    // Mock API Call 1
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ id: 'sess_1' }),
      json: async () => ({ id: 'sess_1' }),
    } as Response);

    // Mock API Call 2
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ id: 'sess_2' }),
      json: async () => ({ id: 'sess_2' }),
    } as Response);

    const p1 = client.session('1').info();
    const p2 = client.session('2').info();

    // Resolve handshake now
    // @ts-ignore
    resolveHandshake({
      ok: true,
      json: async () => ({ success: true, token: 'token_shared' }),
      text: async () =>
        JSON.stringify({ success: true, token: 'token_shared' }),
    } as Response);

    await Promise.all([p1, p2]);

    // Check calls: 1 handshake, 2 requests
    expect(mockFetch).toHaveBeenCalledTimes(3);

    const calls = mockFetch.mock.calls;
    // Count POST calls to proxy
    const handshakeCalls = calls.filter(
      (call) => call[0] === 'https://proxy.com',
    );
    expect(handshakeCalls).toHaveLength(1);
  });
});
