import { Jules, JulesError } from 'julets';

// This is the GitHub repository the agent will work on.
// PLEASE REPLACE THIS with a repository you have connected to your Jules project.
const GITHUB_REPO = 'jules-ai/julets-example'; // e.g., 'your-org/your-repo'

// =============================================================================
// Main Application Logic
// =============================================================================
async function main() {
  // The SDK automatically finds the API key from the JULES_API_KEY environment variable.
  const jules = Jules();

  console.log('Welcome to the julets example!');
  console.log('---------------------------------');

  try {
    // 1. Find a valid source to work with using the built-in helper.
    console.log(`\n🔍 Searching for source: ${GITHUB_REPO}...`);
    const source = await jules.sources.get({ github: GITHUB_REPO });

    if (!source) {
      console.error(`❌ Could not find source. Please ensure '${GITHUB_REPO}' is connected in your Jules project.`);
      return;
    }
    console.log(`✅ Found source: ${source.name}`);

    // 2. Start an interactive session.
    console.log('\n🚀 Starting a new session...');
    const session = await jules.session({
      prompt: "Please find the primary `package.json` file and tell me its name. Do not modify any files.",
      source: {
        github: GITHUB_REPO,
        branch: 'main', // Make sure this branch exists in your repository
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
      console.warn(`⚠️  Outcome: Session finished with state: ${outcome.state}`);
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

// Run the main function
main();
