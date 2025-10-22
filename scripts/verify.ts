import { exec } from 'child_process';
import { rm, readdir } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const EXAMPLE_DIR = path.join(ROOT_DIR, 'examples', 'simple');

async function runCommand(command: string, cwd: string) {
  console.log(`\n$ ${command} [in ${cwd}]`);
  try {
    const { stdout, stderr } = await execAsync(command, { cwd });
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    throw error;
  }
}

async function main() {
  let packedFile: string | undefined;

  try {
    // 1. Clean the example directory
    console.log('--- Cleaning example directory ---');
    await rm(path.join(EXAMPLE_DIR, 'node_modules'), { recursive: true, force: true });
    await rm(path.join(EXAMPLE_DIR, 'package-lock.json'), { force: true });
    console.log('Clean complete.');

    // 2. Build the project
    console.log('\n--- Building project ---');
    await runCommand('npm run build', ROOT_DIR);
    console.log('Build complete.');

    // 3. Pack the project
    console.log('\n--- Packing project ---');
    const { stdout } = await execAsync('npm pack', { cwd: ROOT_DIR });
    packedFile = stdout.trim();
    console.log(`Packed file: ${packedFile}`);

    // 4. Install the packed file in the example project
    console.log('\n--- Installing packed tarball in example project ---');
    await runCommand(`npm install ../../${packedFile}`, EXAMPLE_DIR);
    console.log('Installation complete.');

    // 5. Run type-check in the example project
    console.log('\n--- Verifying type resolution ---');
    await runCommand('npx tsc --noEmit', EXAMPLE_DIR);
    console.log('Type resolution verified successfully.');

    // 6. Run runtime import check in the example project
    console.log('\n--- Verifying runtime import ---');
    await runCommand('npx tsx smoke-test.ts', EXAMPLE_DIR);
    console.log('Runtime import verified successfully.');

    console.log('\n\n✅ Verification successful!');
  } catch (error) {
    console.error('\n\n❌ Verification failed!');
    process.exit(1);
  } finally {
    // 7. Clean up the packed file
    if (packedFile) {
      console.log('\n--- Cleaning up tarball ---');
      await rm(path.join(ROOT_DIR, packedFile));
      console.log('Cleanup complete.');
    }
  }
}

main();