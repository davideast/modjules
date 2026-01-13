#!/usr/bin/env tsx
/**
 * sync-versions.ts
 *
 * Synchronizes package versions across the monorepo.
 * Reads the version from root package.json and updates all publishable packages.
 *
 * Usage:
 *   npm run version:sync          # Apply changes
 *   npm run version:sync -- --dry-run  # Preview changes
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, basename } from 'path';

const ROOT_DIR = join(import.meta.dirname, '..');
const PACKAGES_DIR = join(ROOT_DIR, 'packages');

// Packages to sync (publishable packages in the fixed group)
const SYNC_PACKAGES = ['core', 'mcp', 'server'];

// Internal dependencies that should be updated to the synced version
const INTERNAL_DEPS = ['modjules', '@modjules/mcp', '@modjules/server'];

interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function readPackageJson(path: string): PackageJson {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function writePackageJson(path: string, pkg: PackageJson): void {
  writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
}

function updateDependencies(
  deps: Record<string, string> | undefined,
  targetVersion: string,
): Record<string, string> | undefined {
  if (!deps) return deps;

  const updated = { ...deps };
  for (const dep of INTERNAL_DEPS) {
    if (dep in updated && updated[dep] !== '*') {
      updated[dep] = targetVersion;
    }
  }
  return updated;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  if (dryRun) {
    console.log('🔍 Dry run mode - no changes will be made\n');
  }

  // Read target version from root package.json
  const rootPkgPath = join(ROOT_DIR, 'package.json');
  const rootPkg = readPackageJson(rootPkgPath);
  const targetVersion = rootPkg.version;

  console.log(`📦 Target version: ${targetVersion}\n`);

  const changes: string[] = [];

  for (const pkgDir of SYNC_PACKAGES) {
    const pkgPath = join(PACKAGES_DIR, pkgDir, 'package.json');

    if (!existsSync(pkgPath)) {
      console.warn(`⚠️  Package not found: ${pkgDir}`);
      continue;
    }

    const pkg = readPackageJson(pkgPath);
    const oldVersion = pkg.version;

    if (oldVersion === targetVersion) {
      console.log(`✅ ${pkg.name} already at ${targetVersion}`);
      continue;
    }

    // Update version
    pkg.version = targetVersion;

    // Update internal dependencies
    pkg.dependencies = updateDependencies(pkg.dependencies, targetVersion);
    pkg.devDependencies = updateDependencies(
      pkg.devDependencies,
      targetVersion,
    );
    pkg.peerDependencies = updateDependencies(
      pkg.peerDependencies,
      targetVersion,
    );

    changes.push(`${pkg.name}: ${oldVersion} → ${targetVersion}`);

    if (!dryRun) {
      writePackageJson(pkgPath, pkg);
      console.log(`📝 Updated ${pkg.name}: ${oldVersion} → ${targetVersion}`);
    } else {
      console.log(
        `📝 Would update ${pkg.name}: ${oldVersion} → ${targetVersion}`,
      );
    }
  }

  console.log('');

  if (changes.length === 0) {
    console.log('✨ All packages already in sync!');
  } else if (dryRun) {
    console.log(`🔎 ${changes.length} package(s) would be updated`);
  } else {
    console.log(`✨ Synced ${changes.length} package(s) to ${targetVersion}`);
  }
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
