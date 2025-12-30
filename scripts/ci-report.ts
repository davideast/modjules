import { execSync } from 'node:child_process';
import { Jules } from '../src/index.ts';

/**
 * Validates and retrieves required environment variables.
 * Provides helpful errors for local development.
 */
function getRequiredEnv() {
  const required = ['JULES_API_KEY'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `❌ Missing required environment variables: ${missing.join(', ')}\n` +
      `Ensure JULES_API_KEY is set in your terminal or .env file.`
    );
  }

  // Fallback for BRANCH_NAME: Use CI env or try to detect local git branch
  const branchName = process.env.BRANCH_NAME ||
                     process.env.GITHUB_HEAD_REF ||
                     tryGetLocalBranch();

  if (!branchName) {
    throw new Error(
      '❌ Could not determine Branch Name.\n' +
      'In CI, ensure BRANCH_NAME is passed. Locally, ensure you are in a git repo.'
    );
  }

  return {
    apiKey: process.env.JULES_API_KEY!,
    branchName,
    files: process.env.FILES_CHANGED || 'Unknown',
    errType: process.env.ERROR_TYPE || 'Manual Trigger',
    // Decode base64 log if present
    errLog: process.env.ERROR_LOG
      ? Buffer.from(process.env.ERROR_LOG, 'base64').toString()
      : 'No logs provided.'
  };
}

function tryGetLocalBranch(): string | null {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

async function reportToJules() {
  try {
    const config = getRequiredEnv();

    // Extract Session ID from end of branch (matches -123456789)
    const sessionId = config.branchName.split('-').pop();

    if (!sessionId || isNaN(Number(sessionId))) {
      console.log(`ℹ️ Branch "${config.branchName}" is not a Jules session. Skipping report.`);
      return;
    }

    console.log(`🚀 Reporting to Jules Session: ${sessionId}...`);
    const jules = new Jules(config.apiKey);

    const message = `🚨 **CI Failure: ${config.errType}**

**Files Changed:** \`${config.files}\`

**Logs:**
\`\`\`text
${config.errLog}
\`\`\`

Please analyze the failure and push a fix to branch \`${config.branchName}\`.`;

    await jules.session(sessionId).message(message);
    console.log('✅ Success: Message sent to Jules.');

  } catch (err: any) {
    console.error(err.message || 'An unexpected error occurred during reporting.');
    process.exit(1);
  }
}

reportToJules();
