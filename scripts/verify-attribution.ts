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

  // We need to check all commits in the PR range
  // The BASE_REF and HEAD_REF are usually available in PR context,
  // but we can rely on git log origin/base..HEAD if checked out properly.
  // In GitHub Actions 'checkout@v4' with fetch-depth: 0, we can use origin/target...HEAD
  const baseRef = process.env.GITHUB_BASE_REF || 'main';
  const headSha = process.env.GITHUB_HEAD_SHA || 'HEAD';

  const prUserLogin = process.env.PR_USER_LOGIN || '';
  const prUserId = process.env.PR_USER_ID || '';

  if (prUserLogin !== 'google-labs-jules' && !prUserLogin.endsWith('[bot]')) {
    console.log('Skipping attribution check for human PR.');
    process.exit(0);
  }

  if (!token) {
    console.error('❌ GITHUB_TOKEN is required.');
    process.exit(1);
  }

  console.log('🔍 Analyzing PR body for attribution...');
  let targetUser = findHumanUser(prBody);
  let targetUserId = '';
  let targetUserLogin = '';
  let targetUserName = ''; // Display name for the trailer

  if (targetUser) {
    console.log(`✅ Found mention: @${targetUser}`);
    try {
      const user = await getGitHubUser(targetUser, token);
      targetUserId = String(user.id);
      targetUserLogin = user.login; // Use canonical case
      targetUserName = user.name || user.login; // Display name, fallback to login
    } catch (e) {
      console.warn(
        `⚠️ Could not resolve user @${targetUser}. Falling back to PR creator.`,
      );
      console.error(e);
      targetUser = null;
    }
  }

  if (!targetUser) {
    // Fallback - need to fetch display name for PR creator
    console.log(`ℹ️ No valid mention found. Using PR creator: ${prUserLogin}`);
    targetUserLogin = prUserLogin;
    targetUserId = prUserId;
    try {
      const user = await getGitHubUser(prUserLogin, token);
      targetUserName = user.name || user.login;
    } catch {
      targetUserName = prUserLogin; // Fallback to login if API fails
    }
  }

  if (!targetUserLogin || !targetUserId) {
    console.error('❌ Could not determine user for attribution.');
    process.exit(1);
  }

  // The email is the definitive identifier - name can vary (display name vs login)
  const expectedEmail = `${targetUserId}+${targetUserLogin}@users.noreply.github.com`;
  // Use display name for the suggested trailer (e.g., "David East" not "davideast")
  const trailer = `Co-authored-by: ${targetUserName} <${expectedEmail}>`;
  console.log(`🎯 Expected Email: "${expectedEmail}"`);
  console.log(`🎯 Suggested Trailer: "${trailer}"`);

  console.log(`🔍 Checking commits in range origin/${baseRef}...${headSha}`);

  let logs = '';
  try {
    // Get all commit messages in the PR range
    logs = execSync(
      `git log origin/${baseRef}...${headSha} --pretty=%B`,
    ).toString();
  } catch (e) {
    console.warn('⚠️ Could not fetch commit range. Checking HEAD only.');
    logs = execSync('git show -s --format=%B HEAD').toString();
  }

  // Check for the email pattern - the name before it can vary
  // Valid: "Co-authored-by: David East <id+login@...>" or "Co-authored-by: davideast <id+login@...>"
  if (logs.includes(expectedEmail) && logs.includes('Co-authored-by:')) {
    console.log('✅ Attribution present in at least one commit.');
    process.exit(0);
  } else {
    console.error('❌ Missing attribution in all commits.');

    // Write to GITHUB_OUTPUT if available
    const githubOutput = process.env.GITHUB_OUTPUT;
    if (githubOutput) {
      const message = `Missing attribution. Please append this to your commit message: ${trailer}`;
      const b64Log = Buffer.from(message).toString('base64');
      fs.appendFileSync(githubOutput, `log=${b64Log}\n`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
