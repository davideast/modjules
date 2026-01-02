/**
 * Trigger Jules session to implement SessionClient.snapshot()
 *
 * Run: bun scripts/trigger-snapshot-implementation.ts
 */
import { jules } from '../src/index.js';

const PROMPT = `Update SessionSnapshot to implement .toMarkdown() method.

## Goal
Add a \`toMarkdown()\` method to \`SessionSnapshot\` and \`SessionSnapshotImpl\` that outputs a human-readable summary of the session.

## Specification

Reference \`spec/snapshot.md\` (Section 5.2) and \`spec/snapshot/cases.yaml\` (MD-01).

## Required Changes

### [MODIFY] src/types.ts
- Add \`toMarkdown(): string;\` to \`SessionSnapshot\` interface.

### [MODIFY] src/snapshot.ts
- Implement \`toMarkdown()\` in \`SessionSnapshotImpl\`.
- Format should include:
  - Header with Title/Status
  - Timeline section (formatted list)
  - Insights section (bullet points)
  - Pre-computed stats

### [MODIFY] tests/snapshot/spec.test.ts
- Add tests for MD-01 case.

## Verification
Run \`bun test tests/snapshot/\`

## Pre-commit Requirements
1. Run \`npm run precommit\`
2. Include this exact trailer in your commit message:
   \`Co-authored-by: davideast <4570265+davideast@users.noreply.github.com>\`
`;

async function main() {
  console.log('🚀 Creating Jules session for snapshot implementation...\n');

  try {
    const session = await jules.run({
      prompt: PROMPT,
      source: { github: 'davideast/modjules', branch: 'main' },
      autoPr: true,
    });

    console.log('✅ Session created!');
    console.log(`   ID: ${session.id}`);
    console.log(`   URL: https://jules.google.com/session/${session.id}`);
    console.log('\n📡 Streaming activity updates...\n');

    for await (const activity of session.stream()) {
      const timestamp = new Date().toISOString().slice(11, 19);
      console.log(`[${timestamp}] ${activity.type}`);

      if (
        activity.type === 'sessionCompleted' ||
        activity.type === 'sessionFailed'
      ) {
        console.log('\n🏁 Session finished.');
        break;
      }
    }

    const outcome = await session.result();
    console.log(`   Final state: ${outcome.state}`);
    if (outcome.pullRequest) {
      console.log(`   PR: ${outcome.pullRequest.url}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
