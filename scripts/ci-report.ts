import { jules } from '../src/index.ts';

async function report() {
  try {
    const branchName = process.env.BRANCH_NAME;
    if (!branchName) {
      console.error('❌ Missing BRANCH_NAME environment variable.');
      process.exit(1);
    }

    // Extract Session ID (everything after the last hyphen)
    // Example: jules-sync-engine-17764518042547328191 -> 17764518042547328191
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
    const filesChanged = process.env.FILES_CHANGED || 'None/Unknown';
    const errorLogB64 = process.env.ERROR_LOG_B64;

    const log = errorLogB64
      ? Buffer.from(errorLogB64, 'base64').toString('utf-8')
      : 'No details provided.';

    const client = jules.with({ apiKey });

    const content = `🚨 **CI Failure: ${errorType}**

**Files Changed:** \`${filesChanged}\`

**Logs:**
\`\`\`text
${log}
\`\`\`

Please fix the issues in branch \`${branchName}\`.`;

    console.log(`🚀 Reporting failure (${errorType}) to Session ID: ${sessionId}...`);
    await client.session(sessionId).send(content);
    console.log('✅ Success: Report sent to Jules.');
  } catch (e: any) {
    console.error('❌ Failed to report to Jules:', e);
    process.exit(1);
  }
}

report();
