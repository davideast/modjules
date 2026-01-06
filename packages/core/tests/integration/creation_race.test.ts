// tests/integration/creation_race.test.ts
import { jules as defaultJules } from '../../src/index.js';
import { describe, it, expect, vi } from 'vitest';

describe.skipIf(!process.env.JULES_API_KEY || !process.env.TEST_GITHUB_REPO)(
  'Session Creation Race Condition',
  () => {
    it('should not throw a 404 when streaming activities immediately after session creation', async () => {
      const jules = defaultJules.with({
        apiKey: process.env.JULES_API_KEY,
      });

      const session = await jules.session({
        prompt: 'A test prompt to reproduce the creation race condition.',
        source: {
          github: process.env.TEST_GITHUB_REPO!,
          branch: 'main', // Assuming the test repo has a 'main' branch.
        },
      });

      // The stream() method returns an AsyncIterable. To get the first item,
      // we can use a `for await...of` loop and break after the first iteration.
      let firstActivity;
      for await (const activity of session.stream()) {
        firstActivity = activity;
        break; // We only need the first one for this test.
      }

      expect(firstActivity).toBeDefined();
    }, 90000); // 90-second timeout to accommodate retries
  },
);
