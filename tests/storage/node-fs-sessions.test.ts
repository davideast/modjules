import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { NodeSessionStorage } from '../../src/storage/node-fs.js';
import { SessionResource } from '../../src/types.js';

const TEST_DIR = path.resolve(__dirname, '.test-cache');

describe('NodeSessionStorage', () => {
  let storage: NodeSessionStorage;

  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    storage = new NodeSessionStorage(TEST_DIR);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('persists a session and updates the index', async () => {
    const session = {
      id: 'sess_123',
      title: 'Test',
      state: 'running',
      createTime: new Date().toISOString(),
      sourceContext: { source: 'sources/github/owner/repo' },
    } as unknown as SessionResource;

    await storage.upsert(session);

    // 1. Verify File Structure
    const fileExists = await fs.stat(
      path.join(TEST_DIR, '.jules/cache/sess_123/session.json'),
    );
    expect(fileExists.isFile()).toBe(true);

    // 2. Verify Index
    const indexContent = await fs.readFile(
      path.join(TEST_DIR, '.jules/cache/sessions.jsonl'),
      'utf8',
    );
    expect(indexContent).toContain('"id":"sess_123"');
    expect(indexContent).toContain('"title":"Test"');
  });

  it('handles updates via append-only index', async () => {
    const s1 = {
      id: '1',
      title: 'Start',
      state: 'running',
      createTime: new Date().toISOString(),
    } as unknown as SessionResource;
    const s2 = {
      id: '1',
      title: 'Start',
      state: 'completed',
      createTime: s1.createTime,
    } as unknown as SessionResource; // Same ID, new State

    await storage.upsert(s1);
    await storage.upsert(s2);

    // Verify Session File is the LATEST
    const loaded = await storage.get('1');
    expect(loaded?.resource.state).toBe('completed');

    // Verify Index has history (2 lines)
    const indexContent = await fs.readFile(
      path.join(TEST_DIR, '.jules/cache/sessions.jsonl'),
      'utf8',
    );
    const lines = indexContent.trim().split('\n');
    expect(lines.length).toBe(2);
  });

  it('upsertMany processes multiple sessions', async () => {
    const sessions = Array.from(
      { length: 5 },
      (_, i) =>
        ({
          id: `batch_${i}`,
          title: `Batch ${i}`,
          state: 'queued',
          createTime: new Date().toISOString(),
        }) as unknown as SessionResource,
    );

    await storage.upsertMany(sessions);

    // Verify all files exist
    for (const s of sessions) {
      const p = await storage.get(s.id);
      expect(p?.resource.title).toBe(s.title);
    }

    // Verify index length
    const indexContent = await fs.readFile(
      path.join(TEST_DIR, '.jules/cache/sessions.jsonl'),
      'utf8',
    );
    expect(indexContent.trim().split('\n').length).toBe(5);
  });

  it('delete removes directory but leaves index (for now)', async () => {
    const session = {
      id: 'del_1',
      title: 'Delete Me',
      state: 'running',
      createTime: new Date().toISOString(),
    } as unknown as SessionResource;

    await storage.upsert(session);
    await storage.delete('del_1');

    const loaded = await storage.get('del_1');
    expect(loaded).toBeUndefined();

    // Check directory is gone
    await expect(
      fs.stat(path.join(TEST_DIR, '.jules/cache/del_1')),
    ).rejects.toThrow();

    // Index still has the entry
    const indexContent = await fs.readFile(
      path.join(TEST_DIR, '.jules/cache/sessions.jsonl'),
      'utf8',
    );
    expect(indexContent).toContain('"id":"del_1"');
  });

  it('scanIndex yields entries', async () => {
    const s1 = {
      id: 'scan_1',
      title: 'Scan 1',
      state: 'running',
      createTime: new Date().toISOString(),
    } as unknown as SessionResource;
    await storage.upsert(s1);

    const entries = [];
    for await (const entry of storage.scanIndex()) {
      entries.push(entry);
    }
    expect(entries.length).toBe(1);
    expect(entries[0].id).toBe('scan_1');
  });
});
