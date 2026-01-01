import { describe, test, expect, vi, afterEach } from 'vitest';
import { registerAction } from '../../src/mcp/commands/register.js';
import * as os from 'node:os';

vi.mock('node:os');

describe('modjules-mcp register gemini', () => {
  const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('outputs correct configuration', async () => {
    vi.mocked(os.homedir).mockReturnValue('/mock/home');

    vi.mock('@inquirer/prompts', () => ({
      confirm: vi.fn().mockResolvedValue(false),
      input: vi.fn(),
    }));

    await registerAction('gemini');

    const output = consoleLog.mock.calls.map((c) => c.join(' ')).join('\n');

    expect(output).toContain(
      'Configuration for Antigravity (/mock/home/.gemini/antigravity/mcp_config.json)',
    );

    expect(output).toContain('"mcpServers": {');
    expect(output).toContain('"modjules": {');
    expect(output).toContain('"command": "npx"');

    expect(output).toContain('"env": {');
    expect(output).toContain('"HOME": "/mock/home"');
    expect(output).toContain('"JULES_API_KEY": "<YOUR_API_KEY>"');

    expect(output).toContain('Replace <YOUR_API_KEY> with your Jules API key');
  });
});
