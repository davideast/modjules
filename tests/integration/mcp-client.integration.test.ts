import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Increased timeout for this integration test suite
vi.setConfig({ testTimeout: 60000 });

describe('MCP Client Integration Test', () => {
  let devServerProcess: ChildProcess;

  beforeAll(async () => {
    // Start the Next.js dev server for the jules-agent example
    devServerProcess = spawn(
      'npm',
      ['run', 'dev', '--prefix', 'examples/jules-agent'],
      {
        detached: true, // Allows us to kill the process and its children
      },
    );

    // Wait for the server to be ready by listening for the debugger message
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Dev server failed to start in time.'));
      }, 30000); // 30-second timeout

      devServerProcess.stdout?.on('data', (data: Buffer) => {
        if (data.toString().includes('Debugger listening on')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      devServerProcess.stderr?.on('data', (data: Buffer) => {
        if (data.toString().includes('Debugger listening on')) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
  });

  afterAll(() => {
    // Stop the dev server process
    if (devServerProcess && devServerProcess.pid) {
      // Kill the entire process group to ensure the Next.js server also stops
      process.kill(-devServerProcess.pid, 'SIGKILL');
    }
  });

  it('should successfully connect to the MCP server and list tools', async () => {
    const { stdout, stderr } = await execAsync('npm run mcp:client');

    expect(stdout).toContain('MCP client connected.');
    expect(stdout).toContain('Available tools:');
    expect(stdout).toContain('nextjs_runtime');
  });
});
