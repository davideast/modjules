import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const arg = process.argv[2];

if (!arg) {
  console.error(
    'Error: Please provide a GitHub username or a full "Co-authored-by" string.',
  );
  console.error('Usage:');
  console.error('  bun scripts/fix-attribution.ts username');
  console.error(
    '  bun scripts/fix-attribution.ts "Co-authored-by: Name <email>"',
  );
  process.exit(1);
}

async function getAttributionString(input: string): Promise<string> {
  // If it's already a full trailer, use it
  if (input.startsWith('Co-authored-by: ')) {
    return input;
  }

  // Otherwise, treat as username and fetch ID
  console.log(`Fetching GitHub ID for user: ${input}...`);
  try {
    const res = await fetch(`https://api.github.com/users/${input}`);
    if (!res.ok) {
      throw new Error(`GitHub API returned ${res.status}: ${res.statusText}`);
    }
    const data = (await res.json()) as {
      id: number;
      login: string;
      name?: string;
    };

    const name = data.name || data.login;
    const email = `${data.id}+${data.login}@users.noreply.github.com`;
    return `Co-authored-by: ${name} <${email}>`;
  } catch (error: any) {
    console.error(`Failed to fetch GitHub user data: ${error.message}`);
    process.exit(1);
  }
}

(async () => {
  try {
    const attributionString = await getAttributionString(arg);
    console.log(`Using attribution: ${attributionString}`);

    console.log('Fixing attribution...');

    // 1. Get the current commit message
    const currentMsg = execSync('git log -1 --pretty=%B').toString().trim();

    // Optimized: Normalize whitespace for the check
    if (currentMsg.replace(/\s+/g, ' ').includes(attributionString)) {
      console.log('Attribution already present.');
      process.exit(0);
    }

    // 2. Use Git's built-in trailer logic to avoid manual string concat issues
    const tempFile = join(process.cwd(), '.COMMIT_EDITMSG_FIX');

    // Write current message to temp file first so we can interpret trailers on it
    writeFileSync(tempFile, currentMsg);

    try {
      // This command adds the trailer correctly at the end of the message
      execSync(
        `git interpret-trailers --trailer "${attributionString}" --in-place "${tempFile}"`,
      );

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
})();
