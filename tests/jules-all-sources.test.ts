import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JulesClientImpl } from '../src/client.js';
import { NodePlatform } from '../src/platform/node.js';
import { AutomatedSession, SessionConfig } from '../src/types.js';

// Mock dependencies
const mockRun = vi.fn();

// Mock the client class partially
class MockJulesClient extends JulesClientImpl {
  constructor() {
    // Pass dummy dependencies
    super({}, () => ({}) as any, new NodePlatform());
  }

  // Override run to mock it
  async run(config: SessionConfig): Promise<AutomatedSession> {
    return mockRun(config);
  }
}

describe('jules.allSources', () => {
  let client: MockJulesClient;

  beforeEach(() => {
    client = new MockJulesClient();
    mockRun.mockReset();
  });

  it('should process all sources and return results in order', async () => {
    const sources = [
      { github: 'user/repo1', branch: 'main' },
      { github: 'user/repo2', branch: 'dev' },
    ];
    mockRun.mockImplementation(
      async (config) => ({ id: `session-${config.source.github}` }) as any,
    );

    const results = await client.allSources({
      prompt: 'Test prompt',
      sources,
    });

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('session-user/repo1');
    expect(results[1].id).toBe('session-user/repo2');
    expect(mockRun).toHaveBeenCalledTimes(2);
    expect(mockRun).toHaveBeenCalledWith({
      prompt: 'Test prompt',
      source: sources[0],
    });
    expect(mockRun).toHaveBeenCalledWith({
      prompt: 'Test prompt',
      source: sources[1],
    });
  });

  it('should respect concurrency limit', async () => {
    const sources = [
      { github: 'user/repo1', branch: 'main' },
      { github: 'user/repo2', branch: 'main' },
      { github: 'user/repo3', branch: 'main' },
      { github: 'user/repo4', branch: 'main' },
    ];
    let running = 0;
    let maxRunning = 0;

    mockRun.mockImplementation(async (config) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, 10));
      running--;
      return { id: `session-${config.source.github}` } as any;
    });

    await client.allSources(
      {
        prompt: 'Test prompt',
        sources,
      },
      { concurrency: 2 },
    );

    expect(maxRunning).toBe(2);
    expect(mockRun).toHaveBeenCalledTimes(4);
  });

  it('should fail fast if stopOnError is true (default)', async () => {
    const sources = [
      { github: 'user/repo1', branch: 'main' },
      { github: 'user/repo2', branch: 'main' },
      { github: 'user/repo3', branch: 'main' },
    ];
    mockRun.mockImplementation(async (config) => {
      if (config.source.github === 'user/repo2') throw new Error('Failed');
      return { id: `session-${config.source.github}` } as any;
    });

    await expect(
      client.allSources({
        prompt: 'Test prompt',
        sources,
      }),
    ).rejects.toThrow('Failed');
  });

  it('should aggregate errors if stopOnError is false', async () => {
    const sources = [
      { github: 'user/repo1', branch: 'main' },
      { github: 'user/repo2', branch: 'main' },
      { github: 'user/repo3', branch: 'main' },
    ];
    mockRun.mockImplementation(async (config) => {
      if (config.source.github === 'user/repo2') throw new Error('Failed 2');
      if (config.source.github === 'user/repo3') throw new Error('Failed 3');
      return { id: `session-${config.source.github}` } as any;
    });

    try {
      await client.allSources(
        {
          prompt: 'Test prompt',
          sources,
        },
        { stopOnError: false },
      );
    } catch (err: any) {
      expect(err).toBeInstanceOf(AggregateError);
      expect(err.errors).toHaveLength(2);
      expect(err.errors[0].message).toBe('Failed 2');
      expect(err.errors[1].message).toBe('Failed 3');
    }
  });

  it('should handle delayMs', async () => {
    vi.useFakeTimers();
    const sources = [
      { github: 'user/repo1', branch: 'main' },
      { github: 'user/repo2', branch: 'main' },
    ];
    mockRun.mockImplementation(
      async (config) => ({ id: `session-${config.source.github}` }) as any,
    );

    const promise = client.allSources(
      {
        prompt: 'Test prompt',
        sources,
      },
      { delayMs: 1000, concurrency: 1 },
    );

    // Start
    expect(mockRun).not.toHaveBeenCalled();

    // Advance time for first item
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockRun).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(mockRun).toHaveBeenCalledTimes(2);

    await promise;
    vi.useRealTimers();
  });

  it('should use a default concurrency of 4', async () => {
    const sources = [
      { github: 'user/repo1', branch: 'main' },
      { github: 'user/repo2', branch: 'main' },
      { github: 'user/repo3', branch: 'main' },
      { github: 'user/repo4', branch: 'main' },
      { github: 'user/repo5', branch: 'main' },
      { github: 'user/repo6', branch: 'main' },
    ];
    let running = 0;
    let maxRunning = 0;

    mockRun.mockImplementation(async (config) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, 20));
      running--;
      return { id: `session-${config.source.github}` } as any;
    });

    await client.allSources({
      prompt: 'Test prompt',
      sources,
    });

    expect(maxRunning).toBe(4);
  });
});
