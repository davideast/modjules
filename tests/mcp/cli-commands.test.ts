import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as inquirer from '@inquirer/prompts';
import { doctorAction } from '../../src/mcp/commands/doctor.js';
import { registerAction } from '../../src/mcp/commands/register.js';
import { resolveApiKey } from '../../src/mcp/config.js';
import { jules } from '../../src/index.js';

// Mocks
vi.mock('fs');
vi.mock('os');
vi.mock('path');
vi.mock('dns/promises', () => ({
  default: {
    lookup: vi.fn(),
  },
}));
vi.mock('@inquirer/prompts');
vi.mock('../../src/mcp/config.js');
vi.mock('../../src/index.js', () => ({
  jules: {
    with: vi.fn(),
  },
}));

describe('CLI Commands', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;
  let processStdoutWriteSpy: any;

  beforeEach(() => {
    vi.resetAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as any);
    processStdoutWriteSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    // Default mocks
    (os.homedir as any).mockReturnValue('/mock/home');
    (path.join as any).mockImplementation((...args: string[]) =>
      args.join('/'),
    );
    (path.dirname as any).mockImplementation((p: string) =>
      p.substring(0, p.lastIndexOf('/')),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('doctorAction', () => {
    it('should exit 0 if all checks pass', async () => {
      // Mock checks passing
      (resolveApiKey as any).mockReturnValue('valid-key');
      const mockClient = {
        sessions: vi.fn().mockResolvedValue([]), // mock thenable cursor
      };
      (jules.with as any).mockReturnValue(mockClient);

      await doctorAction();

      expect(processExitSpy).not.toHaveBeenCalled(); // Implicit success
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('All checks passed'),
      );
    });

    it('should exit 1 if checks fail', async () => {
      // Mock failure (missing API key)
      (resolveApiKey as any).mockReturnValue(undefined);

      await doctorAction();

      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Doctor found issues'),
      );
    });

    it('should check connectivity', async () => {
      const dns = await import('dns/promises');
      (dns.default.lookup as any).mockResolvedValue({ address: '1.1.1.1' });
      (resolveApiKey as any).mockReturnValue('valid-key');
      const mockClient = { sessions: vi.fn().mockResolvedValue([]) };
      (jules.with as any).mockReturnValue(mockClient);

      await doctorAction();

      expect(dns.default.lookup).toHaveBeenCalled();
    });
  });

  describe('registerAction', () => {
    it('should print config for cursor', async () => {
      await registerAction('cursor');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Configuration for Cursor'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('modjules-mcp'),
      );
    });

    it('should print config for gemini', async () => {
      await registerAction('gemini');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Configuration for Antigravity'),
      );
    });

    it('should prompt for claude auto-install and write file on yes', async () => {
      // Setup
      const configPath =
        '/mock/home/Library/Application Support/Claude/claude_desktop_config.json';
      (inquirer.confirm as any).mockResolvedValue(true);
      (fs.existsSync as any).mockReturnValue(false); // New file

      await registerAction('claude');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Configuration for Claude Desktop'),
      );
      expect(inquirer.confirm).toHaveBeenCalled();

      // Verify file write
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('Claude'),
        { recursive: true },
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        configPath,
        expect.stringContaining('modjules-mcp'),
      );
    });

    it('should not write file if user declines claude install', async () => {
      (inquirer.confirm as any).mockResolvedValue(false);
      await registerAction('claude');
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });
});
