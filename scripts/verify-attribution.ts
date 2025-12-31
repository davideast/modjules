import { execSync } from 'node:child_process';
import * as fs from 'node:fs';

/**
 * Parses the PR body to find a human user mention.
 * Ignores the bot user 'google-labs-jules'.
 */
function findHumanUser(body: string): string | null {
  // Regex to find @username
  // Matches @ followed by alphanumerics/hyphens
  const regex = /@([a-zA-Z0-9-]+)/g;
  let match;

  while ((match = regex.exec(body)) !== null) {
    const username = match[1];
    if (username !== 'google-labs-jules' && !username.endsWith('[bot]')) {
      return username;
    }
  }
  return null;
}

async function getGitHubUser(username: string, token: string) {
  const res = await fetch(`https://api.github.com/users/${username}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch user ${username}: ${res.status} ${res.statusText}`,
    );
  }

  return res.json();
}

async function main() {
  const prBody = process.env.PR_BODY || '';
  const token = process.env.GITHUB_TOKEN;

  // Environment variable for commit range (default to HEAD if missing, though typically supplied)
  const commitRange = process.env.COMMIT_RANGE;

  const prUserLogin = process.env.PR_USER_LOGIN || '';
  const prUserId = process.env.PR_USER_ID || '';

  if (!token) {
    console.error('❌ GITHUB_TOKEN is required.');
    process.exit(1);
  }

  console.log('🔍 Analyzing PR body for attribution...');
  let targetUser = findHumanUser(prBody);
  let targetUserId = '';
  let targetUserLogin = '';

  if (targetUser) {
    console.log(`✅ Found mention: @${targetUser}`);
    try {
      const user = await getGitHubUser(targetUser, token);
      targetUserId = String(user.id);
      targetUserLogin = user.login; // Use canonical case
    } catch (e) {
      console.warn(
        `⚠️ Could not resolve user @${targetUser}. Falling back to PR creator.`,
      );
      console.error(e);
      targetUser = null;
    }
  }

  if (!targetUser) {
    // Fallback
    console.log(`ℹ️ No valid mention found. Using PR creator: ${prUserLogin}`);
    targetUserLogin = prUserLogin;
    targetUserId = prUserId;
  }

  if (!targetUserLogin || !targetUserId) {
    console.error('❌ Could not determine user for attribution.');
    process.exit(1);
  }

  const trailer = `Co-authored-by: ${targetUserLogin} <${targetUserId}+${targetUserLogin}@users.noreply.github.com>`;
  console.log(`🎯 Expected Trailer: "${trailer}"`);

  // Identify commits to check
  // If commitRange is provided (e.g. "base..head"), list all commits in that range.
  // Otherwise fallback to single check of HEAD (legacy behavior, or if run locally without range).
  let commitMsgs: string[] = [];

  if (commitRange) {
    try {
      // --no-merges to skip merge commits which might not need attribution
      // format=%B gets the raw body
      // We use a custom separator to split commits safely
      const rawLog = execSync(
        `git log ${commitRange} --no-merges --format="%B%n---COMMIT_SEPARATOR---"`,
      ).toString();
      commitMsgs = rawLog
        .split('\n---COMMIT_SEPARATOR---\n')
        .filter((msg) => msg.trim().length > 0);
    } catch (e) {
      console.warn(
        `⚠️ Failed to list commits in range ${commitRange}. Checking HEAD only.`,
      );
      commitMsgs = [execSync('git show -s --format=%B HEAD').toString()];
    }
  } else {
    // Legacy / Fallback
    const singleMsg =
      process.env.COMMIT_MSG ||
      execSync('git show -s --format=%B HEAD').toString();
    commitMsgs = [singleMsg];
  }

  console.log(`🔍 Verifying ${commitMsgs.length} commit(s)...`);

  let missingCount = 0;
  for (const msg of commitMsgs) {
    if (!msg.includes(trailer)) {
      missingCount++;
    }
  }

  if (missingCount === 0) {
    console.log('✅ Attribution present in all checked commits.');
    process.exit(0);
  } else {
    console.error(`❌ Missing attribution in ${missingCount} commit(s).`);

    // Write to GITHUB_OUTPUT if available
    const githubOutput = process.env.GITHUB_OUTPUT;
    if (githubOutput) {
      const message = `Missing attribution in ${missingCount} commit(s). Please append this to your commit message(s): ${trailer}`;
      fs.appendFileSync(githubOutput, `log=${message}\n`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
