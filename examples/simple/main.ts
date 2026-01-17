import { jules, JulesError, SessionClient } from 'modjules';

// This is the GitHub repository the agent will work on.
// PLEASE REPLACE THIS with a repository you have connected to your Jules project.
const GITHUB_REPO = 'davideast/modjules'; // e.g., 'your-org/your-repo'

// =============================================================================
// Main Application Logic
// =============================================================================
async function main() {
  // The SDK automatically finds the API key from the JULES_API_KEY environment variable.
  // No need to call a factory anymore, just use 'jules' directly or jules.with()

  console.log('Welcome to the julets example!');
  console.log('---------------------------------');

  try {
    // 1. Find a valid source to work with using the built-in helper.
    console.log(`\n🔍 Searching for source: ${GITHUB_REPO}...`);
    const source = await jules.sources.get({ github: GITHUB_REPO });

    if (!source) {
      console.error(
        `❌ Could not find source. Please ensure '${GITHUB_REPO}' is connected in your Jules project.`,
      );
      return;
    }
    console.log(`✅ Found source: ${source.name}`);
    console.log(JSON.stringify(source, null, 2));

    // 2. Start an interactive session.
    console.log('\n🚀 Starting a new session...');
    const session = await jules.session({
      prompt: `Analyze this library 'modjules', which is a TypeScript SDK client for the Jules REST API.

  Your task is to act as a Product Manager for the 'modjules' SDK and propose a roadmap of new features.
  
  IMPORTANT CONSTRAINTS:
  1. The underlying Jules REST API is FIXED and cannot be changed. DO NOT suggest features that require new backend API endpoints (like new ML models, backend usage tracking, or server-side multi-repo support).
  2. Focus ONLY on client-side improvements: developer experience (DX), better abstractions, local tooling, integrations, or helper methods that make the existing API easier to use.
  
  Consult the 'docs.md' to understand the raw API's limitations, and then review the 'src/' directory to see what the SDK currently currently abstracts.
  
  Write your assessment in a file called 'features.md'.
  
  Generate 10 feature proposals. Each must include:
  - Category (e.g., DX, Integration, Tooling, Helper)
  - Complexity (Low/Medium/High)
  - Impact (Low/Medium/High)
  - A high-level TypeScript API code example of how the user would use it.
  
  Inlcude at least 2 "Big, Bold, Creative" ideas that push the boundaries of what a client-side SDK can do (e.g., CLIs, local file watchers, CI/CD wrappers, interactive terminal UIs).`,
      source: {
        github: GITHUB_REPO,
        branch: 'main',
        environmentVariablesEnabled: true,
      },
    });
    console.log(`✅ Session created with ID: ${session.id}`);

    // 3. Stream progress and print key events.
    console.log('\n... Streaming activities ...');
    for await (const activity of session.stream()) {
      if (activity.type === 'progressUpdated') {
        console.log(`[AGENT] ${activity.title}`);
      }
      if (activity.type === 'agentMessaged') {
        console.log(`[AGENT] ${activity.message}`);
      }
    }

    // 4. Wait for the final result.
    const outcome = await session.result();
    console.log('\n... Session finished ...');

    if (outcome.state === 'completed') {
      console.log('✅ Outcome: Session completed successfully.');
    } else {
      console.warn(
        `⚠️  Outcome: Session finished with state: ${outcome.state}`,
      );
    }
  } catch (error) {
    // 5. Handle potential errors from the SDK.
    if (error instanceof JulesError) {
      console.error(`\n❌ An SDK error occurred: ${error.constructor.name}`);
      console.error(error.message);
      if (error.cause) {
        console.error('  Underlying cause:', error.cause);
      }
    } else {
      console.error('\n❌ An unexpected error occurred:', error);
    }
  }
}

async function lookup() {
  // The SDK automatically finds the API key from the JULES_API_KEY environment variable.
  // const jules = Jules(); // Removed factory

  // Check for a session ID argument from the command line
  const existingSessionId = process.argv[2];

  console.log('Welcome to the julets example!');
  console.log('---------------------------------');

  try {
    let session: SessionClient;

    if (existingSessionId) {
      // --- Rehydrate Existing Session ---
      console.log(`\n🔄 Rehydrating session ID: ${existingSessionId}...`);
      session = jules.session(existingSessionId);
      // Optional: Quick check to see if it's valid/accessible
      const info = await session.info();
      console.log(`✅ Session found. Current state: ${info.state}`);
    } else {
      // --- Create New Session ---
      console.log(`\n🔍 Searching for source: ${GITHUB_REPO}...`);
      const source = await jules.sources.get({ github: GITHUB_REPO });

      if (!source) {
        console.error(
          `❌ Could not find source. Please ensure '${GITHUB_REPO}' is connected.`,
        );
        return;
      }
      console.log(`✅ Found source: ${source.name}`);

      console.log('\n🚀 Starting a new session...');
      session = await jules.session({
        prompt: `Analyze this library julets... (truncated for brevity)`,
        source: {
          github: GITHUB_REPO,
          branch: 'main',
        },
      });
      console.log(`✅ Session created with ID: ${session.id}`);
    }

    // --- Common Logic (Streaming & Waiting) ---

    console.log('\n... Streaming activities ...');
    // This loop will pick up from wherever the session currently is.
    // If rehydrating a completed session, it might immediately yield nothing
    // or just the final events, depending on API behavior for old activities.
    for await (const activity of session.stream()) {
      if (activity.type === 'progressUpdated') {
        console.log(`[AGENT] ${activity.title}`);
      }
      if (activity.type === 'agentMessaged') {
        console.log(`[AGENT] ${activity.message}`);
      }
      // Optional: Handle terminal states in stream if you want immediate feedback
      if (activity.type === 'sessionCompleted') {
        console.log('[STREAM] Session completed event received.');
      }
    }

    console.log('\n... Waiting for final result ...');
    const outcome = await session.result();

    if (outcome.state === 'completed') {
      console.log('✅ Outcome: Session completed successfully.');
      if (outcome.pullRequest) {
        console.log(`🔗 PR: ${outcome.pullRequest.url}`);
      }
    } else {
      console.warn(
        `⚠️  Outcome: Session finished with state: ${outcome.state}`,
      );
    }
  } catch (error) {
    if (error instanceof JulesError) {
      console.error(`\n❌ An SDK error occurred: ${error.constructor.name}`);
      console.error(error.message);
    } else {
      console.error('\n❌ An unexpected error occurred:', error);
    }
  }
}

main();
// lookup();
