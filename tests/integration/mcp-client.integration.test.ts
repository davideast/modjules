import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('MCP Client Integration Test', () => {
  let devServerProcess: ChildProcess;
  let devServerPort: number;

  beforeAll(async () => {
    // Start the Next.js dev server for the jules-agent example
    devServerProcess = spawn(
      'npm',
      ['run', 'dev', '--prefix', 'examples/jules-agent'],
      {
        detached: true, // Allows us to kill the process and its children
      },
    );

    // Wait for the server to be ready and capture the port
    devServerPort = await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Dev server failed to start in time.'));
      }, 50000); // 50-second timeout for server startup

      let foundPort: number | null = null;

      const onData = (data: Buffer) => {
        const output = data.toString();
        // First, find and store the port
        if (output.includes('- Local:')) {
          const portMatch = output.match(/http:\/\/localhost:(\d+)/);
          if (portMatch) {
            foundPort = parseInt(portMatch[1], 10);
          }
        }
        // Then, wait for the ready signal
        if (output.includes('✓ Ready') && foundPort) {
          clearTimeout(timeout);
          resolve(foundPort);
        }
      };

      devServerProcess.stdout?.on('data', onData);
      devServerProcess.stderr?.on('data', onData);
    });
  }, 60000); // 60-second timeout for the entire beforeAll hook

  afterAll(() => {
    // Stop the dev server process
    if (devServerProcess && devServerProcess.pid) {
      // Kill the entire process group to ensure the Next.js server also stops
      try {
        process.kill(-devServerProcess.pid, 'SIGKILL');
      } catch (e) {
        // Ignore errors if the process is already gone
      }
    }
  }, 60000); // 60-second timeout for the afterAll hook

  it('should successfully connect to the MCP server and call a tool', async () => {
    const { stdout } = await execAsync(
      `npm run mcp:client -- --port=${devServerPort}`,
    );

    expect(stdout).toContain('MCP client connected.');
    expect(stdout).toContain(`Using port ${devServerPort}.`);
    expect(stdout).toContain('Calling get_errors tool via nextjs_runtime...');
    expect(stdout).toContain('get_errors result:');
    // The result is a JSON string inside a text property, so the quotes are escaped.
    expect(stdout).toContain('\\"success\\":true');
  }, 60000); // 60-second timeout for the test itself
});
