import { exec } from 'child_process';
import { rm, readdir } from 'fs/promises';
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
    const { stdout, stderr } = await execAsync(command, { cwd });
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

async function verifyExample(exampleDir: string, packedFile: string) {
  console.log(`\n--- Verifying Example: ${path.basename(exampleDir)} ---`);

  // 1. Clean the example directory
  console.log('Cleaning example directory...');
  await rm(path.join(exampleDir, 'node_modules'), {
    recursive: true,
    force: true,
  });
  await rm(path.join(exampleDir, 'package-lock.json'), { force: true });
  // Special case for Next.js caching
  if (path.basename(exampleDir) === 'nextjs') {
    await rm(path.join(exampleDir, '.next'), { recursive: true, force: true });
  }
  console.log('Clean complete.');

  // 2. Install the packed file in the example project
  console.log('Installing packed tarball...');
  // Note: We use the relative path from the example dir to the root
  const relativePackedPath = path.join('..', '..', packedFile);
  // The --legacy-peer-deps flag is required for the Next.js example.
  // We'll run the command from within the example directory.
  const installCommand = `npm install --legacy-peer-deps ${relativePackedPath}`;
  await runCommand(installCommand, exampleDir);
  console.log('Installation complete.');

  // 3. Run the verification script for the example
  console.log('Running verification script...');
  await runCommand('npm run verify', exampleDir);
  console.log(`✅ Verification successful for ${path.basename(exampleDir)}!`);
}

async function main() {
  let packedFile: string | undefined;

  try {
    // 1. Build the project
    console.log('--- Building root project ---');
    await runCommand('npm run build', ROOT_DIR);
    console.log('Build complete.');

    // 2. Pack the project
    console.log('\n--- Packing root project ---');
    const { stdout } = await execAsync('npm pack', { cwd: ROOT_DIR });
    // Get the last non-empty line from stdout, which is the tarball filename.
    packedFile = stdout.trim().split('\n').filter(Boolean).pop();
    if (!packedFile) {
      throw new Error('Could not determine packed file name from npm pack.');
    }
    console.log(`Packed file: ${packedFile}`);

    // 3. Determine which examples to verify
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

    // 4. Run verification for each example
    for (const dir of exampleDirs) {
      await verifyExample(dir, packedFile);
    }

    console.log('\n\n✅ All verifications successful!');
  } catch (error) {
    console.error('\n\n❌ Verification failed!');
    process.exit(1);
  } finally {
    // 5. Clean up the packed file
    if (packedFile) {
      console.log('\n--- Cleaning up tarball ---');
      await rm(path.join(ROOT_DIR, packedFile));
      console.log('Cleanup complete.');
    }
  }
}

main();
