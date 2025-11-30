import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Browser Build Regression', () => {
  it('should not contain references to the global process variable', () => {
    // Navigate from tests/regression/ to dist/browser.mjs
    const distPath = path.resolve(__dirname, '../../dist/browser.mjs');

    if (!fs.existsSync(distPath)) {
      throw new Error(
        `Browser build artifact not found at ${distPath}. Run npm run build first.`,
      );
    }

    const content = fs.readFileSync(distPath, 'utf-8');

    // Regex to match 'process' as a standalone identifier.
    // (?<!\.) ensures it is not a property access like obj.process
    // \bprocess\b ensures it is the whole word "process"
    // This will match:
    //   typeof process
    //   process.env
    //   if (process)
    // It will NOT match:
    //   globalThis.process
    //   window.process
    const forbiddenPattern = /(?<!\.)\bprocess\b/;

    const match = content.match(forbiddenPattern);

    if (match && match.index !== undefined) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(content.length, match.index + 30);
      const snippet = content.slice(start, end);
      console.error(
        `\n❌ Found 'process' variable usage in browser bundle:\n...${snippet}...\n`,
      );
    }

    expect(match).toBeNull();
  });
});
