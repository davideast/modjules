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
    throw new Error(`Failed to fetch user ${username}: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

async function main() {
  const prBody = process.env.PR_BODY || '';
  const token = process.env.GITHUB_TOKEN;
  const commitMsg = process.env.COMMIT_MSG || '';
  // Fallback to PR creator if no mention found?
  // User prompt: "It needs to be a real user... I wanted it to be me since I was mentioned in the PR body"
  // If no mention, maybe fall back to PR user login?
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
      console.warn(`⚠️ Could not resolve user @${targetUser}. Falling back to PR creator.`);
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
    // Fail safe? Or just exit success?
    // "The CI ... will fail ... if it is missing."
    // If we can't determine WHO, we can't fail reliably.
    process.exit(1);
  }

  const trailer = `Co-authored-by: ${targetUserLogin} <${targetUserId}+${targetUserLogin}@users.noreply.github.com>`;
  console.log(`🎯 Expected Trailer: "${trailer}"`);

  if (commitMsg.includes(trailer)) {
    console.log('✅ Attribution present.');
    process.exit(0);
  } else {
    console.error('❌ Missing attribution.');

    // Write to GITHUB_OUTPUT if available
    const githubOutput = process.env.GITHUB_OUTPUT;
    if (githubOutput) {
      const message = `Missing attribution. Please append this to your commit message: ${trailer}`;
      fs.appendFileSync(githubOutput, `log=${message}\n`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
