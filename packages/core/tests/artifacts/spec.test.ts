import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { ChangeSetArtifact, GitPatch, ParsedChangeSet } from '../../src/artifacts.js';

interface TestCase {
  id: string;
  description: string;
  status: 'pending' | 'implemented' | 'skipped';
  given: {
    gitPatch: GitPatch;
  };
  then: {
    result: ParsedChangeSet;
  };
}

// Load and parse the YAML test cases
const casesFile = fs.readFileSync(
  'spec/artifacts/cases.yaml',
  'utf8',
);
const testCases = yaml.load(casesFile) as TestCase[];

describe('ChangeSetArtifact.parsed() spec', () => {
  for (const testCase of testCases) {
    if (testCase.status === 'pending' || testCase.status === 'skipped') {
      it.skip(`[${testCase.id}] ${testCase.description}`, () => {});
      continue;
    }

    it(`[${testCase.id}] ${testCase.description}`, () => {
      // --- GIVEN ---
      const artifact = new ChangeSetArtifact('agent', testCase.given.gitPatch);

      // --- WHEN ---
      const result = artifact.parsed();

      // --- THEN ---
      expect(result).toEqual(testCase.then.result);
    });
  }
});
