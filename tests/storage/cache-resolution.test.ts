import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getRootDir } from '../../src/index.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  accessSync: vi.fn(),
  constants: { W_OK: 1 },
}));

vi.mock('node:os', () => ({
  homedir: vi.fn(),
}));

describe('Cache Directory Resolution', () => {
  let fs, os;

  beforeEach(async () => {
    fs = await import('node:fs');
    os = await import('node:os');
    vi.resetAllMocks();
    // Default mocks for a happy path
    fs.accessSync.mockReturnValue(true);
    os.homedir.mockReturnValue('/Users/test');
    process.env.HOME = '/Users/test';
    process.env.JULES_HOME = '';
    process.env.TMPDIR = '/tmp';
  });

  it('CACHE-01: should return cwd when package.json exists', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/tmp/my-project');
    fs.existsSync.mockImplementation(
      (p) => p === '/tmp/my-project/package.json',
    );

    const rootDir = getRootDir();
    expect(rootDir).toBe('/tmp/my-project');
  });

  it('CACHE-02: should return home when no package.json in cwd', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/tmp/random-dir');
    fs.existsSync.mockReturnValue(false);

    const rootDir = getRootDir();
    expect(rootDir).toBe('/Users/test');
  });

  it('CACHE-03: JULES_HOME should override everything', () => {
    process.env.JULES_HOME = '/data/jules-override';
    vi.spyOn(process, 'cwd').mockReturnValue('/tmp/my-project');
    fs.existsSync.mockImplementation(
      (p) => p === '/tmp/my-project/package.json',
    );

    const rootDir = getRootDir();
    expect(rootDir).toBe('/data/jules-override');
  });

  it('CACHE-04: should fall back to TMPDIR when home is not writable', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/tmp/random-dir');
    fs.existsSync.mockReturnValue(false);
    fs.accessSync.mockImplementation((p) => {
      if (p === '/Users/test') {
        throw new Error('Permission denied');
      }
    });

    const rootDir = getRootDir();
    expect(rootDir).toBe('/tmp');
  });
});
