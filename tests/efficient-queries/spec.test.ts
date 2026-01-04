import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { getSessionCount } from '../../src/storage/cache-info.js';

// Mock the fs/promises module
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises');
  return {
    ...actual,
    readdir: vi.fn(),
  };
});

// Define the type for a test case
type TestCase = {
  id: string;
  description: string;
  category: string;
  status: 'pending' | 'implemented';
  testedIn?: string;
  given: {
    cachedSessions?: number;
  };
  when: string;
  then: {
    result?: number;
    performance: {
      fullScanRequired: boolean;
    };
  };
};

// Read and parse the spec file
const specFile = await fsPromises.readFile(
  'spec/efficient-queries/cases.yaml',
  'utf8',
);
const testCases = (yaml.load(specFile) as TestCase[]).filter(
  (tc) => tc.status === 'implemented',
);

const rootDir = path.resolve('./tests/temp/efficient-queries-spec');
const cacheDir = path.join(rootDir, '.jules/cache');

describe('Efficient Queries Spec', () => {
  beforeEach(async () => {
    await fsPromises.mkdir(cacheDir, { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await fsPromises.rm(rootDir, { recursive: true, force: true });
  });

  for (const tc of testCases) {
    if (tc.id !== 'EFF-02') continue;

    it(`EFF-02: ${tc.description}`, async () => {
      // Write global metadata file (no actual session dirs needed)
      const metadata = {
        lastSyncedAt: Date.now(),
        sessionCount: tc.given.cachedSessions,
      };
      await fsPromises.writeFile(
        path.join(cacheDir, 'global-metadata.json'),
        JSON.stringify(metadata),
        'utf8',
      );

      const count = await getSessionCount(rootDir);
      expect(count).toBe(tc.then.result);

      // Verify O(1) - readdir NOT called
      if (!tc.then.performance.fullScanRequired) {
        expect(vi.mocked(fsPromises.readdir)).not.toHaveBeenCalled();
      }
    });
  }
});
