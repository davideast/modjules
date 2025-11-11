// tests/session_activities.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JulesClient, SessionClient } from '../src/index.js';
import { jules as defaultJules } from '../src/index.js';
import { ActivityStorage } from '../src/storage/types.js';
import { NetworkAdapter } from '../src/network/adapter.js';

// This is a simplified mock. In a real scenario, this would be more robust.
vi.mock('../src/activities/client.js', () => {
  const DefaultActivityClient = vi.fn();
  DefaultActivityClient.prototype.history = vi
    .fn()
    .mockImplementation(async function* () {
      yield { type: 'history' };
    });
  DefaultActivityClient.prototype.updates = vi
    .fn()
    .mockImplementation(async function* () {
      yield { type: 'updates' };
    });
  DefaultActivityClient.prototype.select = vi
    .fn()
    .mockResolvedValue([{ type: 'select' }]);
  return { DefaultActivityClient };
});

describe('SessionClient Activity Methods', () => {
  let jules: JulesClient;
  let session: SessionClient;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    jules = defaultJules.with({ apiKey: 'test-key' });
    // Re-instantiating the session will use the fresh mocks
    session = jules.session('SESSION_123');
  });

  it('session.history() should delegate to activityClient.history()', async () => {
    const historyIterator = session.history()[Symbol.asyncIterator]();
    const result = await historyIterator.next();

    const { DefaultActivityClient } = await import(
      '../src/activities/client.js'
    );
    const mockActivityClientInstance = (DefaultActivityClient as any).mock
      .instances[0];

    expect(mockActivityClientInstance.history).toHaveBeenCalledTimes(1);
    expect(result.value).toEqual({ type: 'history' });
  });

  it('session.updates() should delegate to activityClient.updates()', async () => {
    const updatesIterator = session.updates()[Symbol.asyncIterator]();
    const result = await updatesIterator.next();

    const { DefaultActivityClient } = await import(
      '../src/activities/client.js'
    );
    const mockActivityClientInstance = (DefaultActivityClient as any).mock
      .instances[0];

    expect(mockActivityClientInstance.updates).toHaveBeenCalledTimes(1);
    expect(result.value).toEqual({ type: 'updates' });
  });

  it('session.select() should delegate to activityClient.select()', async () => {
    const result = await session.select({ type: 'test' });

    const { DefaultActivityClient } = await import(
      '../src/activities/client.js'
    );
    const mockActivityClientInstance = (DefaultActivityClient as any).mock
      .instances[0];

    expect(mockActivityClientInstance.select).toHaveBeenCalledTimes(1);
    expect(mockActivityClientInstance.select).toHaveBeenCalledWith({
      type: 'test',
    });
    expect(result).toEqual([{ type: 'select' }]);
  });
});
