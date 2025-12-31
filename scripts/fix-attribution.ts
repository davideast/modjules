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

  // 2. Construct the new message (Blank line + Trailer)
  // Ensure we don't add too many blank lines if one exists
  const newMsg = `${currentMsg}\n\n${attributionArg}`;

  // 3. Amend the commit safely using a temporary file
  // This avoids issues with shell quoting of complex messages
  const tempFile = join(process.cwd(), '.COMMIT_EDITMSG_FIX');
  writeFileSync(tempFile, newMsg);

  try {
    // Added --no-gpg-sign for CI/Automation compatibility
    execSync(`git commit --amend -F "${tempFile}" --no-verify --no-gpg-sign`);
  } finally {
    try {
      unlinkSync(tempFile);
    } catch {
      // Ignore cleanup error
    }
  }

  // 4. Force push safely
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
