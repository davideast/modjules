// scripts/ci-report.ts
import { jules } from '../src/index.ts';

async function report() {
  try {
    const branchName = process.env.BRANCH_NAME;
    if (!branchName) {
      console.error('❌ Missing BRANCH_NAME environment variable.');
      process.exit(1);
    }

    const sessionId = branchName.split('-').pop();

    if (!sessionId || !/^\d+$/.test(sessionId)) {
      console.log(`ℹ️ Branch "${branchName}" does not appear to contain a numeric Session ID. Skipping report.`);
      return;
    }

    const apiKey = process.env.JULES_API_KEY;
    if (!apiKey) {
      console.error('❌ Missing JULES_API_KEY environment variable.');
      process.exit(1);
    }

    const errorType = process.env.ERROR_TYPE || 'Unknown Failure';
    const filesChangedRaw = process.env.FILES_CHANGED || '';
    const errorLogB64 = process.env.ERROR_LOG_B64;

    const log = errorLogB64
      ? Buffer.from(errorLogB64, 'base64').toString('utf-8')
      : 'No details provided.';

    // Format files as a clean list
    const filesList = filesChangedRaw
      .split(' ')
      .filter(f => f.trim().length > 0)
      .map(f => `- \`${f}\``)
      .join('\n');

    const client = jules.with({ apiKey });

    // Build the instructional content
    let instruction = `Please fix the issues in branch \`${branchName}\`.`;

    // Special instruction for Attribution failures
    if (errorType === "Attribution Check") {
      instruction = `To fix this, please **append** the required trailer to your previous commit(s).
Do **not** perform a soft reset. Instead, use:
\`\`\`bash
git commit --amend --no-edit --message "$(git log -1 --format=%B)" --message "Co-authored-by: ... (copy trailer from log below)"
\`\`\``;
    }

    const content = `🚨 **CI Failure: ${errorType}**

**Files Changed:**
${filesList || 'None detected.'}

**Logs:**
\`\`\`text
${log}
\`\`\`

${instruction}`;

    console.log(`🚀 Reporting failure (${errorType}) to Session ID: ${sessionId}...`);
    await client.session(sessionId).send(content);
    console.log('✅ Success: Report sent to Jules.');
  } catch (e: any) {
    console.error('❌ Failed to report to Jules:', e);
    process.exit(1);
  }
}

report();
