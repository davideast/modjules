import { Jules } from 'julets';
import * as fs from 'fs/promises';
import * as _path from 'path';

async function main() {
  console.log('Starting idea generation script...');

  // Read existing features to provide context in the prompt
  const featuresFilePath = _path.resolve(process.cwd(), 'features.md');
  const existingFeatures = await fs.readFile(featuresFilePath, 'utf-8');
  console.log('Read existing features.md file.');

  // Extract repo owner and name from GitHub environment variable
  const repoSlug = process.env.GITHUB_REPOSITORY;
  if (!repoSlug || !repoSlug.includes('/')) {
    console.error(
      'Error: GITHUB_REPOSITORY environment variable is not set or is invalid.',
    );
    console.error('This script is intended to be run in a GitHub Action.');
    process.exit(1);
  }
  const [owner, repo] = repoSlug.split('/');
  console.log(`Running for repository: ${owner}/${repo}`);

  const prompt = `
    Act as an expert Product Manager for the 'julets' SDK. Your task is to generate 3 new, creative feature ideas and append them to the existing roadmap in the 'features.md' file.

    First, carefully read the existing feature ideas in 'features.md' to avoid duplication. The current content is provided below:
    ---
    ${existingFeatures}
    ---

    Next, generate exactly 3 new feature proposals that are not duplicates of the existing ones.

    Follow these constraints for the new ideas:
    1.  **Client-Side Only**: All proposals must be achievable within the SDK itself, without requiring changes to the backend Jules REST API.
    2.  **Focus**: Ideas should center on developer experience (DX), new abstractions, tooling, integrations, or helper methods.
    3.  **No New CLI**: The Jules CLI already exists. Do not suggest creating a new one.

    For each new proposal, you MUST use the following markdown format, continuing the numbering from the existing list.
    (For example, if the last item is #15, the new items should be #16, #17, #18).

    ### [Number]. [Feature Title]
    - **Category:** (DX, Integration, Tooling, Helper)
    - **Complexity:** (Low/Medium/High)
    - **Impact:** (Low/Medium/High)
    - **Description:** (A brief explanation of the feature.)
    - **API Example:**
    \`\`\`typescript
    // A high-level code example.
    \`\`\`

    Your goal is to perform a single file modification: update 'features.md' by appending your 3 new, formatted ideas to the end of the file. Preserve all existing content.
  `;

  // The Jules factory function will automatically pick up the JULES_API_KEY from env
  const jules = Jules();

  console.log('Initiating a fire-and-forget Jules session...');

  // This creates a session that will automatically create a PR on completion
  const session = jules.run({
    source: {
      github: { owner, repo },
      branch: 'main',
    },
    prompt,
    title: 'feat: Add new SDK feature ideas',
    autoPr: true,
  });

  console.log(
    '✅ Jules session initiated successfully. A new PR with feature ideas will be created shortly.',
  );
}

main().catch((error) => {
  console.error('❌ An unexpected error occurred:', error);
  process.exit(1);
});
