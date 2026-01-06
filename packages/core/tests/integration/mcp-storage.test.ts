import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { connect } from '../../src/index.js';

describe('MCP Server Storage Integration', () => {
  const testDir = join(tmpdir(), 'modjules-test-' + Date.now());

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });
    process.env.JULES_HOME = testDir;
  });

  afterAll(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {}
    delete process.env.JULES_HOME;
  });

  test('storage initializes without error when JULES_HOME is set', async () => {
    const client = connect({ apiKey: 'dummy-key' });

    try {
      await client.sessions({ limit: 1 });
    } catch (error: any) {
      // We allow API errors (401, 403, etc) or fetch errors
      // But we explicitly FAIL if we see ENOENT or EACCES which indicate storage path issues
      if (error.code === 'ENOENT' || error.code === 'EACCES') {
        throw error;
      }
      // Also check message content just in case
      if (error.message.includes('mkdir')) {
        throw error;
      }
    }
  });
});
