import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

async function runCommand(
  command: string,
  cwd: string = ROOT_DIR,
): Promise<string> {
  console.log(`$ ${command} [in ${path.relative(ROOT_DIR, cwd) || '.'}]`);
  try {
    const { stdout } = await execAsync(command, {
      cwd,
      maxBuffer: 1024 * 1024 * 10,
    });
    return stdout.trim();
  } catch (error: any) {
    console.error(`Error executing command: ${command}`);
    if (error.stdout) console.error('--- STDOUT ---\n', error.stdout);
    if (error.stderr) console.error('--- STDERR ---\n', error.stderr);
    throw error;
  }
}

async function main() {
  let tarballPath: string | undefined;
  let tmpDir: string | undefined;

  try {
    console.log('\n=== 1. Build and Pack ===');
    await runCommand('npm run build', ROOT_DIR);

    const packOutput = await runCommand('npm pack', ROOT_DIR);
    const lines = packOutput.trim().split('\n');
    const tarballName = lines[lines.length - 1].trim();

    if (!tarballName || !tarballName.endsWith('.tgz')) {
      throw new Error(
        `Could not determine tarball filename from output:\n${packOutput}`,
      );
    }

    tarballPath = path.join(ROOT_DIR, tarballName);
    console.log(`Creating tarball: ${tarballPath}`);

    console.log('\n=== 2. Inspect Tarball Contents ===');
    const tarList = await runCommand(`tar -tf "${tarballName}"`, ROOT_DIR);
    const files = new Set(tarList.split('\n').map((f) => f.trim()));

    const REQUIRED_FILES = [
      'package/package.json',
      'package/README.md',
      'package/dist/index.js',
      'package/dist/index.d.ts',
    ];

    const missing = REQUIRED_FILES.filter((f) => !files.has(f));
    if (missing.length > 0) {
      console.error('Tarball contents:', Array.from(files).sort());
      throw new Error(
        `❌ Tarball is missing critical files:\n   - ${missing.join('\n   - ')}`,
      );
    }
    console.log('✅ Tarball contains all critical files.');

    console.log('\n=== 3. Functional Verification ===');
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'julets-smoke-'));
    console.log(`Created temporary directory: ${tmpDir}`);

    // 3a. Initialize temp project
    await fs.writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify(
        {
          name: 'smoke-test-consumer',
          type: 'module',
        },
        null,
        2,
      ),
    );

    // 3b. Install tarball and typescript
    // Installing typescript might be slow, but it's necessary for standard 'tsc' run in isolation.
    // Alternatively we could try to use the root's tsc, but it might have resolution issues with the internal node_modules.
    // Let's try installing it, it's safer.
    console.log('Installing dependencies (this may take a moment)...');
    // Suppress output unless it fails to keep logs clean, or keep it for debugging?
    // runCommand logs it.
    await runCommand(
      `npm install "${tarballPath}" typescript @types/node`,
      tmpDir,
    );

    // 3c. Type Check
    console.log('\n--- Running Type Check ---');
    const testTs = `
import { jules } from 'julets';

async function test() {
  // Verify types resolve and we can access methods
  // We don't need valid arguments, just checking if TS complains about missing library
  if (typeof jules.run !== 'function') {
      throw new Error('Runtime type mismatch during type check fake run');
  }
}
`;
    await fs.writeFile(path.join(tmpDir, 'test.ts'), testTs);
    await fs.writeFile(
      path.join(tmpDir, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            target: 'ESNext',
            strict: true,
            noEmit: true,
            skipLibCheck: true,
            // Ensure we don't accidentally pick up root types if something goes wrong, strictly look in local node_modules
            typeRoots: ['./node_modules/@types'],
          },
        },
        null,
        2,
      ),
    );

    await runCommand('npx tsc', tmpDir);
    console.log('✅ Type Check Passed');

    // 3d. Runtime Check
    console.log('\n--- Running Runtime Check ---');
    const testJs = `
import { jules } from 'julets';
import assert from 'node:assert';

console.log('Testing runtime import...');
try {
  assert.ok(typeof jules.run === 'function', 'jules.run should be a function');
  assert.ok(typeof jules.session === 'function', 'jules.session should be a function');
  console.log('✅ Runtime import successful');
} catch (e) {
  console.error('Runtime failed:', e);
  process.exit(1);
}
`;
    await fs.writeFile(path.join(tmpDir, 'test.js'), testJs);
    await runCommand('node test.js', tmpDir);

    console.log('\n✨ Smoke Test Passed Successfully! ✨');
  } catch (error) {
    console.error('\n❌ Smoke Test Failed!');
    // console.error(error); // runCommand already logs errors usually
    process.exit(1);
  } finally {
    if (tarballPath) await fs.unlink(tarballPath).catch(() => {});
    if (tmpDir)
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

main();
