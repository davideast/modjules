import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const attributionArg = process.argv[2];

if (!attributionArg) {
  console.error(
    'Error: Please provide the "Co-authored-by: ..." string as the first argument.',
  );
  console.error(
    'Usage: npx tsx scripts/fix-attribution.ts "Co-authored-by: Name <email>"',
  );
  process.exit(1);
}

if (!attributionArg.startsWith('Co-authored-by: ')) {
  console.error('Error: Argument must start with "Co-authored-by: "');
  process.exit(1);
}

try {
  console.log('Fixing attribution...');

  // 1. Get the current commit message
  const currentMsg = execSync('git log -1 --pretty=%B').toString().trim();

  // Optimized: Normalize whitespace for the check
  if (currentMsg.replace(/\s+/g, ' ').includes(attributionArg)) {
    console.log('Attribution already present.');
    process.exit(0);
  }

  // 2. Use Git's built-in trailer logic to avoid manual string concat issues
  // This avoids issues with shell quoting of complex messages
  const tempFile = join(process.cwd(), '.COMMIT_EDITMSG_FIX');

  // Write current message to temp file first so we can interpret trailers on it
  writeFileSync(tempFile, currentMsg);

  try {
    // This command adds the trailer correctly at the end of the message
    execSync(`git interpret-trailers --trailer "${attributionArg}" --in-place "${tempFile}"`);

    // Now commit using the file updated by interpret-trailers
    // Added --no-gpg-sign for CI/Automation compatibility
    execSync(`git commit --amend -F "${tempFile}" --no-verify --no-gpg-sign`);
  } finally {
    try {
      unlinkSync(tempFile);
    } catch {
      // Ignore cleanup error
    }
  }

  // 3. Force push safely
  const branchName = execSync('git rev-parse --abbrev-ref HEAD')
    .toString()
    .trim();

  console.log(`Pushing fix to ${branchName}...`);
  execSync(`git push origin ${branchName} --force-with-lease`);

  console.log('Attribution fixed and pushed successfully.');
} catch (error: any) {
  console.error('Failed to fix attribution:', error.message || error);
  process.exit(1);
}
