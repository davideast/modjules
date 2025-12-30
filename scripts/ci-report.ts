import { Jules } from 'modjules';

/**
 * Reports CI failures back to the active Jules session.
 * Expects environment variables to be set by the GitHub Action.
 */
async function reportToJules() {
  const {
    JULES_API_KEY,
    BRANCH_NAME,
    FILES_CHANGED,
    ERROR_TYPE,
    ERROR_LOG,
  } = process.env;

  if (!JULES_API_KEY || !BRANCH_NAME) {
    console.error('Missing required environment variables for reporting.');
    process.exit(1);
  }

  // Extract Session ID from end of branch (e.g., branch-name-12345)
  const sessionId = BRANCH_NAME.split('-').pop();
  if (!sessionId || isNaN(Number(sessionId))) {
    console.log('Not a Jules-managed branch. Skipping report.');
    return;
  }

  const jules = new Jules(JULES_API_KEY);

  const message = `🚨 **CI Failure: ${ERROR_TYPE}**

**Files Changed:** \`${FILES_CHANGED}\`

**Logs:**
\`\`\`text
${ERROR_LOG ? Buffer.from(ERROR_LOG, 'base64').toString() : 'No logs provided.'}
\`\`\`

Please analyze the failure and push a fix to branch \`${BRANCH_NAME}\`.`;

  try {
    await jules.session(sessionId).message(message);
    console.log(`Successfully reported failure to session: ${sessionId}`);
  } catch (err) {
    console.error('Failed to send message to Jules:', err);
    process.exit(1);
  }
}

reportToJules();
