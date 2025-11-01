#!/usr/bin/env tsx
import { select } from '@inquirer/prompts';
import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';

// Configuration Constants
const OWNER = 'davideast';
const REPO = 'julets';
const FIREBASE_PROJECT_ID = 'jules-sdk';

async function getMainToken(): Promise<string> {
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }
  try {
    // Fallback for local developers using GitHub CLI
    return execSync('gh auth token', { encoding: 'utf-8' }).trim();
  } catch (error) {
    throw new Error(
      'No GitHub token found. Set GITHUB_TOKEN env var or run "gh auth login".',
    );
  }
}

async function main() {
  console.log(`🔍 Fetching recent Pull Requests for ${OWNER}/${REPO}...`);

  let token;
  try {
    token = await getMainToken();
  } catch (e) {
    console.error(`\x1b[31mError:\x1b[0m ${(e as Error).message}`);
    process.exit(1);
  }

  const octokit = new Octokit({ auth: token });

  // Calculate filter date (7 days ago)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const dateFilter = sevenDaysAgo.toISOString().split('T')[0];

  // Search for relevant PRs
  const {
    data: { items: prs },
  } = await octokit.rest.search.issuesAndPullRequests({
    q: `repo:${OWNER}/${REPO} is:pr is:open updated:>=${dateFilter}`,
    sort: 'updated',
    order: 'desc',
  });

  if (prs.length === 0) {
    console.log('😴 No active PRs found in the last 7 days.');
    return;
  }

  // Interactive selection
  const selectedPrNumber = await select({
    message: 'Select a PR to preview:',
    choices: prs.map((pr) => ({
      name: `#${pr.number}: ${pr.title} (@${pr.user?.login})`,
      value: pr.number,
      description: `Updated: ${new Date(pr.updated_at).toLocaleString()}`,
    })),
  });

  // The Critical Deterministic URL Construction
  const previewUrl = `https://${FIREBASE_PROJECT_ID}--pr-${selectedPrNumber}.web.app/package.tgz`;

  console.log('\n📦 \x1b[1mPreview Package Ready\x1b[0m');
  console.log('Run the following command in your test project:');
  console.log(`\n \x1b[32mnpm install ${previewUrl}\x1b[0m\n`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
