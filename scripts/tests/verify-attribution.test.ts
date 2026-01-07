import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as yaml from 'js-yaml';
import * as path from 'node:path';
import { findHumanUser } from '../verify-attribution';

interface TestCase {
  id: string;
  description: string;
  category: string;
  status: 'pending' | 'implemented' | 'skipped';
  priority: 'P0' | 'P1' | 'P2';
  when: string;
  given: {
    body: string;
  };
  then: {
    username: string | null;
  };
}

const specFile = path.resolve(
  __dirname,
  '../spec/verify-attribution/cases.yaml',
);
const testCases = yaml.load(fs.readFileSync(specFile, 'utf8')) as TestCase[];

describe('verify-attribution', () => {
  describe('findHumanUser', () => {
    for (const testCase of testCases) {
      if (testCase.when === 'findHumanUser' && testCase.status !== 'skipped') {
        it(testCase.description, () => {
          const result = findHumanUser(testCase.given.body);
          expect(result).toBe(testCase.then.username);
        });
      }
    }
  });
});
