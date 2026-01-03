#!/usr/bin/env bun

/**
 * Quick status report for spec-driven test cases.
 *
 * Usage:
 *   bun scripts/spec-status.ts          # All specs
 *   bun scripts/spec-status.ts github   # Just github spec
 *   bun scripts/spec-status.ts sync     # Just sync spec
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { parse } from 'yaml';

const ROOT = join(import.meta.dirname, '..');
const SPEC_DIR = join(ROOT, 'spec');

interface TestCase {
  id: string;
  description: string;
  category: string;
  status: 'implemented' | 'pending' | 'skipped';
  priority: 'P0' | 'P1' | 'P2';
}

interface SpecSummary {
  name: string;
  cases: TestCase[];
  byStatus: { implemented: number; pending: number; skipped: number };
  byCategory: Record<
    string,
    { implemented: number; pending: number; total: number }
  >;
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

function loadSpec(name: string): SpecSummary {
  const casesPath = join(SPEC_DIR, name, 'cases.yaml');
  const content = readFileSync(casesPath, 'utf-8');
  const cases = parse(content) as TestCase[];

  const byStatus = {
    implemented: cases.filter((c) => c.status === 'implemented').length,
    pending: cases.filter((c) => c.status === 'pending').length,
    skipped: cases.filter((c) => c.status === 'skipped').length,
  };

  const byCategory = cases.reduce(
    (acc, c) => {
      if (!acc[c.category]) {
        acc[c.category] = { implemented: 0, pending: 0, total: 0 };
      }
      acc[c.category].total++;
      if (c.status === 'implemented') acc[c.category].implemented++;
      else if (c.status === 'pending') acc[c.category].pending++;
      return acc;
    },
    {} as Record<
      string,
      { implemented: number; pending: number; total: number }
    >,
  );

  return { name, cases, byStatus, byCategory };
}

function printSpec(spec: SpecSummary, verbose = false) {
  const total = spec.cases.length;
  const pct = Math.round((spec.byStatus.implemented / total) * 100);

  console.log(
    `\n## ${spec.name} (${spec.byStatus.implemented}/${total} = ${pct}%)\n`,
  );

  // By category
  for (const [category, stats] of Object.entries(spec.byCategory)) {
    const catPct = Math.round((stats.implemented / stats.total) * 100);
    const bar =
      stats.implemented === stats.total
        ? '[done]'
        : `[${stats.implemented}/${stats.total}]`;
    console.log(`  ${category}: ${bar} ${catPct}%`);
  }

  // Next pending
  const pending = spec.cases.filter((c) => c.status === 'pending');
  if (pending.length > 0 && verbose) {
    console.log('\n  Next pending:');
    for (const c of pending.slice(0, 5)) {
      console.log(`    - ${c.id}: ${c.description} (${c.priority})`);
    }
    if (pending.length > 5) {
      console.log(`    ... and ${pending.length - 5} more`);
    }
  }
}

function main() {
  const filter = process.argv[2];
  const specs = discoverSpecs();

  console.log('='.repeat(60));
  console.log('Spec Implementation Status');
  console.log('='.repeat(60));

  if (filter) {
    // Show specific spec in detail
    if (!specs.includes(filter)) {
      console.error(`\nSpec not found: ${filter}`);
      console.error(`Available specs: ${specs.join(', ')}`);
      process.exit(1);
    }
    const spec = loadSpec(filter);
    printSpec(spec, true);

    // Show all pending cases
    const pending = spec.cases.filter((c) => c.status === 'pending');
    if (pending.length > 0) {
      console.log('\n  All pending cases:');
      for (const c of pending) {
        console.log(
          `    - ${c.id}: ${c.description} [${c.category}] (${c.priority})`,
        );
      }
    }
  } else {
    // Show all specs summary
    let totalImpl = 0;
    let totalCases = 0;

    for (const name of specs) {
      const spec = loadSpec(name);
      printSpec(spec, true);
      totalImpl += spec.byStatus.implemented;
      totalCases += spec.cases.length;
    }

    const overallPct = Math.round((totalImpl / totalCases) * 100);
    console.log('\n' + '='.repeat(60));
    console.log(`Overall: ${totalImpl}/${totalCases} (${overallPct}%)`);
  }

  console.log('='.repeat(60));
}

main();
