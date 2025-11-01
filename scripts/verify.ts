import { exec } from 'child_process';
import { readdir } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const EXAMPLES_ROOT_DIR = path.join(ROOT_DIR, 'examples');

async function runCommand(command: string, cwd: string) {
  console.log(`\n$ ${command} [in ${path.relative(ROOT_DIR, cwd)}]`);
  try {
    // Increased maxBuffer to 10MB to handle large output from builds
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      maxBuffer: 1024 * 1024 * 10,
    });
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
  } catch (error: any) {
    console.error(`Error executing command: ${command}`);
    console.error('--- STDERR ---');
    console.error(error.stderr);
    console.error('--- STDOUT ---');
    console.error(error.stdout);
    throw error;
  }
}

async function verifyExample(exampleDir: string) {
  console.log(`\n--- Verifying Example: ${path.basename(exampleDir)} ---`);

  // Run the verification script for the example
  // In a workspace, we don't need to install or link anything manually.
  console.log('Running verification script...');
  await runCommand('npm run verify', exampleDir);
  console.log(`✅ Verification successful for ${path.basename(exampleDir)}!`);
}

async function main() {
  try {
    // 1. Build the project
    console.log('--- Building root project ---');
    await runCommand('npm run build', ROOT_DIR);
    console.log('Build complete.');

    // 2. Determine which examples to verify
    const targetArg = process.argv[2];
    let exampleDirs: string[];

    if (targetArg) {
      console.log(`\n--- Target specified: ${targetArg} ---`);
      exampleDirs = [path.join(ROOT_DIR, targetArg)];
    } else {
      console.log('\n--- No target specified, verifying all examples ---');
      const allExamples = await readdir(EXAMPLES_ROOT_DIR, {
        withFileTypes: true,
      });
      exampleDirs = allExamples
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => path.join(EXAMPLES_ROOT_DIR, dirent.name));
    }

    // 3. Run verification for each example
    for (const dir of exampleDirs) {
      await verifyExample(dir);
    }

    console.log('\n\n✅ All verifications successful!');
  } catch (error) {
    console.error('\n\n❌ Verification failed!');
    process.exit(1);
  }
}

main();
