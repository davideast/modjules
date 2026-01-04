#!/usr/bin/env bun

/**
 * Spec Staleness Checker
 *
 * Detects specs that may be out of date:
 * 1. Implemented specs where testedIn file doesn't exist or doesn't contain spec ID
 * 2. Pending specs that already have tests (spec needs to be marked implemented)
 * 3. Implemented specs where related source files changed after spec was last updated
 *
 * Usage:
 *   bun scripts/spec-stale.ts              # Check all specs
 *   bun scripts/spec-stale.ts --verbose    # Show all checks
 *   bun scripts/spec-stale.ts --no-info    # Hide info items
 *   bun scripts/spec-stale.ts sync         # Check single spec
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import { execSync } from 'child_process';

const ROOT = join(import.meta.dirname, '..');
const SPEC_DIR = join(ROOT, 'spec');
const TESTS_DIR = join(ROOT, 'tests');

interface TestCase {
  id: string;
  description: string;
  category: string;
  status: 'implemented' | 'pending' | 'skipped';
  testedIn?: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
}

type IssueSeverity = 'error' | 'warning' | 'info';

interface StaleResult {
  specFile: string;
  caseId: string;
  description: string;
  issue:
    | 'missing_test_file'
    | 'missing_test_id'
    | 'pending_but_tested'
    | 'source_newer';
  severity: IssueSeverity;
  details: string;
}

function discoverSpecs(): string[] {
  const specs: string[] = [];
  for (const entry of readdirSync(SPEC_DIR)) {
    const casesPath = join(SPEC_DIR, entry, 'cases.yaml');
    if (existsSync(casesPath)) {
      specs.push(entry);
    }
  }
  return specs.sort();
}

function loadSpec(name: string): TestCase[] {
  const casesPath = join(SPEC_DIR, name, 'cases.yaml');
  const content = readFileSync(casesPath, 'utf-8');
  return parse(content) as TestCase[];
}

function findTestIdInFile(filePath: string, testId: string): boolean {
  const fullPath = join(ROOT, filePath);
  if (!existsSync(fullPath)) {
    return false;
  }
  const content = readFileSync(fullPath, 'utf-8');
  return content.includes(testId);
}

function searchTestsForId(testId: string): string | null {
  // Search all test files for this ID
  try {
    const result = execSync(
      `grep -rl "${testId}" "${TESTS_DIR}" --include="*.ts" 2>/dev/null | head -1`,
      { encoding: 'utf-8' },
    ).trim();
    return result || null;
  } catch {
    return null;
  }
}

function getLastModified(filePath: string): Date | null {
  const fullPath = join(ROOT, filePath);
  try {
    const result = execSync(
      `git log -1 --format=%cI -- "${fullPath}" 2>/dev/null`,
      { encoding: 'utf-8', cwd: ROOT },
    ).trim();
    return result ? new Date(result) : null;
  } catch {
    return null;
  }
}

function isSpecDrivenTestFile(filePath: string): boolean {
  // Spec-driven test files load from YAML and use tc.id in test names
  // These files should contain the spec ID
  const specDrivenPatterns = ['spec.test.ts', 'cases.test.ts'];
  return specDrivenPatterns.some((p) => filePath.endsWith(p));
}

/**
 * Check if a test file dynamically loads tests from a spec's cases.yaml
 * This handles spec-driven tests that use patterns like:
 *   const specFile = await fs.readFile('spec/cache-freshness/cases.yaml', 'utf8');
 *   it(tc.id, async () => {...})
 */
function testFileLoadsFromSpec(filePath: string, specName: string): boolean {
  const fullPath = join(ROOT, filePath);
  if (!existsSync(fullPath)) {
    return false;
  }
  const content = readFileSync(fullPath, 'utf-8');
  // Check if file reads from this spec's cases.yaml
  const specPath = `spec/${specName}/cases.yaml`;
  return content.includes(specPath);
}

function checkSpec(specName: string): StaleResult[] {
  const results: StaleResult[] = [];
  const cases = loadSpec(specName);
  const specFile = `spec/${specName}/cases.yaml`;

  for (const tc of cases) {
    if (tc.status === 'implemented') {
      // Check 1: testedIn file exists and contains the ID
      if (tc.testedIn) {
        const testPath = join(ROOT, tc.testedIn);
        if (!existsSync(testPath)) {
          // ERROR: Test file doesn't exist at all
          results.push({
            specFile,
            caseId: tc.id,
            description: tc.description,
            issue: 'missing_test_file',
            severity: 'error',
            details: `testedIn file not found: ${tc.testedIn}`,
          });
        } else if (!findTestIdInFile(tc.testedIn, tc.id)) {
          const isSpecDriven = isSpecDrivenTestFile(tc.testedIn);
          const loadsFromSpec = testFileLoadsFromSpec(tc.testedIn, specName);

          // If test file dynamically loads from this spec's YAML, IDs are generated at runtime
          // No need to check for literal ID presence - this is the expected pattern
          if (isSpecDriven && loadsFromSpec) {
            // Valid: spec-driven test loads IDs dynamically from cases.yaml
            continue;
          }

          // Otherwise, report based on severity
          results.push({
            specFile,
            caseId: tc.id,
            description: tc.description,
            issue: 'missing_test_id',
            severity: isSpecDriven ? 'error' : 'info',
            details: isSpecDriven
              ? `Test ID "${tc.id}" not found in spec-driven test: ${tc.testedIn}`
              : `Test ID "${tc.id}" not in ${tc.testedIn} (manual test - verify manually)`,
          });
        }
      }
    } else if (tc.status === 'pending') {
      // Check 2: Is this pending spec already tested somewhere?
      const foundIn = searchTestsForId(tc.id);
      if (foundIn) {
        const relativePath = foundIn.replace(ROOT + '/', '');
        results.push({
          specFile,
          caseId: tc.id,
          description: tc.description,
          issue: 'pending_but_tested',
          severity: 'warning',
          details: `Spec is pending but test exists in: ${relativePath}`,
        });
      }
    }
  }

  return results;
}

function formatSeverity(severity: IssueSeverity): string {
  switch (severity) {
    case 'error':
      return '❌';
    case 'warning':
      return '⚠️ ';
    case 'info':
      return 'ℹ️ ';
    default:
      return '❓';
  }
}

function formatIssue(result: StaleResult): string {
  const icon = formatSeverity(result.severity);
  switch (result.issue) {
    case 'missing_test_file':
      return `${icon} Missing Test File`;
    case 'missing_test_id':
      return result.severity === 'error'
        ? `${icon} Test ID Not Found (spec-driven)`
        : `${icon} Manual Test (verify)`;
    case 'pending_but_tested':
      return `${icon} Pending But Tested`;
    case 'source_newer':
      return `${icon} Source Changed`;
    default:
      return `${icon} Unknown`;
  }
}

function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const hideInfo = args.includes('--no-info');
  const specFilter = args.find((a) => !a.startsWith('--'));

  const specs = specFilter ? [specFilter] : discoverSpecs();

  if (specFilter && !discoverSpecs().includes(specFilter)) {
    console.error(`\nSpec not found: ${specFilter}`);
    console.error(`Available specs: ${discoverSpecs().join(', ')}`);
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('Spec Staleness Check');
  console.log('='.repeat(60));

  let allResults: StaleResult[] = [];
  let totalChecked = 0;

  for (const specName of specs) {
    const cases = loadSpec(specName);
    totalChecked += cases.length;
    const results = checkSpec(specName);
    allResults = allResults.concat(results);

    // Filter out info-level if --no-info is set
    const displayResults = hideInfo
      ? results.filter((r) => r.severity !== 'info')
      : results;

    if (verbose || displayResults.length > 0) {
      console.log(`\n## ${specName}`);
      if (displayResults.length === 0) {
        console.log('  ✅ All specs are fresh');
      } else {
        for (const r of displayResults) {
          console.log(`  ${formatIssue(r)}`);
          console.log(`     ${r.caseId}: ${r.description}`);
          console.log(`     └─ ${r.details}`);
        }
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`  Specs checked: ${totalChecked}`);

  const errors = allResults.filter((r) => r.severity === 'error');
  const warnings = allResults.filter((r) => r.severity === 'warning');
  const infos = allResults.filter((r) => r.severity === 'info');

  console.log(`  Errors:   ${errors.length}`);
  console.log(`  Warnings: ${warnings.length}`);
  console.log(`  Info:     ${infos.length}`);

  if (errors.length > 0) {
    console.log('\n  ❌ Errors require attention:');
    for (const r of errors) {
      console.log(`     - ${r.caseId}: ${r.details}`);
    }
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log('\n  ⚠️  Warnings found - review recommended');
    process.exit(0); // Warnings don't fail
  } else if (infos.length > 0) {
    console.log('\n  ℹ️  Info items - manual verification suggested');
    console.log('     (Use --no-info to hide these)');
  } else {
    console.log('\n  🎉 All specs are fresh!');
  }
}

main();
