# Jules SDK Feature Roadmap

This document outlines a proposed roadmap of 15 new features for the `julets` SDK. The features are designed to improve developer experience, add powerful new abstractions, and provide better tooling, all while working within the constraints of the existing Jules REST API.

---

### 1. Fluent Session Builder

- **Category:** DX
- **Complexity:** Low
- **Impact:** Medium
- **Description:** A builder pattern for constructing and initiating sessions. This provides a more readable and less error-prone way to configure a session compared to a single large configuration object.
- **API Example:**

```typescript
const session = await jules
  .createSession()
  .withGithubRepo('julets/julets')
  .withBranch('main')
  .withPrompt('Refactor the streaming logic.')
  .withTitle('Streaming Logic Refactor')
  .requireApproval()
  .run();

console.log(`Session started: ${session.id}`);
```

### 2. Activity Type Guards

- **Category:** DX
- **Complexity:** Low
- **Impact:** High
- **Description:** Provide type guard functions that allow developers to safely narrow down the type of an `Activity` within the activity stream, improving type safety and code clarity in TypeScript.
- **API Example:**

```typescript
import { isPlanGenerated, isProgressUpdated } from 'julets';

for await (const activity of session.stream()) {
  if (isPlanGenerated(activity)) {
    console.log(
      'Plan:',
      activity.plan.steps.map((s) => s.title),
    );
    await session.approve();
  } else if (isProgressUpdated(activity)) {
    console.log('Progress:', activity.progress.title);
  }
}
```

### 3. Automatic Retries for Network Errors

- **Category:** DX
- **Complexity:** Medium
- **Impact:** Medium
- **Description:** Implement a more robust, configurable retry mechanism (e.g., with exponential backoff) for transient network errors or 5xx server errors, making the SDK more resilient.
- **API Example:**

```typescript
const jules = new JulesClient({
  retry: {
    attempts: 5,
    backoff: 'exponential', // or a custom function
    retryableStatusCodes: [500, 502, 503, 504],
  },
});
```

### 4. Response Validation with Zod

- **Category:** DX
- **Complexity:** Medium
- **Impact:** High
- **Description:** Integrate `zod` to perform runtime validation of API responses. This helps catch unexpected API changes or malformed data early, preventing runtime errors in user code and providing clear validation errors.
- **API Example (Internal Implementation):**

```typescript
// No change for the user, but internally the SDK would do:
import { z } from 'zod';

const SessionSchema = z.object({
  name: z.string(),
  id: z.string(),
  // ... other fields
});

// In the API client:
const rawResponse = await fetch(...);
const validatedData = SessionSchema.parse(rawResponse);
return validatedData;
```

### 5. Enhanced Enum-like Objects

- **Category:** DX
- **Complexity:** Low
- **Impact:** Low
- **Description:** Instead of raw strings for values like `SessionState`, provide frozen objects that offer autocompletion and prevent typos, while still being usable as strings.
- **API Example:**

```typescript
import { SessionState } from 'julets';

// Instead of:
await session.waitFor('awaitingPlanApproval');

// Use:
await session.waitFor(SessionState.AwaitingPlanApproval);
```

### 6. `session.waitForPlan()` Helper

- **Category:** Helper
- **Complexity:** Low
- **Impact:** Medium
- **Description:** A convenience method that abstracts the stream logic to wait specifically for the `planGenerated` activity, simplifying a common workflow.
- **API Example:**

```typescript
const planActivity = await session.waitForPlan({ timeout: 60000 });

if (planActivity) {
  console.log('Plan generated:', planActivity.plan.steps);
  await session.approve();
} else {
  console.error('Timed out waiting for a plan.');
}
```

### 7. `session.on()` Event Emitter

- **Category:** Helper
- **Complexity:** Medium
- **Impact:** High
- **Description:** Implement an EventEmitter-style interface for sessions. This offers a more declarative way to handle different activities as they occur, which can be more intuitive than iterating over the async stream for many use cases.
- **API Example:**

```typescript
session.on('plan', async (plan) => {
  console.log('Received plan:', plan.steps);
  await session.approve();
});

session.on('progress', (progress) => {
  console.log(`[${progress.title}] ${progress.description}`);
});

session.on('error', (error) => {
  console.error('An error occurred:', error);
});

await session.result(); // Wait for completion
```

### 8. Middleware/Plugin System

- **Category:** Integration
- **Complexity:** High
- **Impact:** High
- **Description:** Allow users to hook into the API client's request/response lifecycle. This could be used for custom logging, metrics, request modification, or caching strategies.
- **API Example:**

```typescript
const loggingMiddleware = {
  async onRequest(request) {
    console.log(`--> ${request.method} ${request.url}`);
    return request;
  },
  async onResponse(response) {
    console.log(`<-- ${response.status}`);
    return response;
  },
};

const jules = new JulesClient({
  middlewares: [loggingMiddleware],
});
```

### 9. Local Patch Application Utility

- **Category:** Tooling
- **Complexity:** Medium
- **Impact:** Medium
- **Description:** A utility function that takes a `ChangeSet` artifact from an activity and applies the unidiff patch to the local file system. This is useful for developers who want to preview or apply changes locally without a PR.
- **API Example:**

```typescript
import { applyPatch } from 'julets/patch';

// Assuming `changeSet` is an artifact from an activity
if (changeSet.type === 'changeSet') {
  try {
    await applyPatch(process.cwd(), changeSet.gitPatch.unidiffPatch);
    console.log('Patch applied successfully!');
  } catch (error) {
    console.error('Failed to apply patch:', error);
  }
}
```

### 10. **(Big, Bold)** Interactive CLI for Session Management

- **Category:** Tooling
- **Complexity:** High
- **Impact:** High
- **Description:** An interactive terminal application (built with a library like `ink`) that allows users to view active sessions, stream activities in a formatted way, send messages, and approve plans directly from their terminal. This provides a rich, real-time view without needing to write scripts for simple interactions.
- **API Example (Command Line):**

```bash
$ npx julets-cli dashboard

# UI would show:
#
# SESSIONS
# ┌──────────────────────────────────┬───────────────┬──────────┐
# │ ID                               │ Title         │ Status   │
# ├──────────────────────────────────┼───────────────┼──────────┤
# │ 314159...                        │ My New App    │ AWAITING │
# │ 271828...                        │ Fix the bug   │ FAILED   │
# └──────────────────────────────────┴───────────────┴──────────┘
#
# Use arrow keys to select, [v] to view, [a] to approve.
```

### 11. **(Big, Bold)** CI/CD Assistant for PRs

- **Category:** Integration
- **Complexity:** High
- **Impact:** High
- **Description:** A higher-level wrapper designed for CI/CD environments. It could automatically fetch PR context (diff, comments), create a targeted Jules session to review or fix the PR, and post the results back as a PR comment. This automates the process of using Jules for code review or automated fixes within a CI pipeline.
- **API Example (in a GitHub Action):**

```typescript
import { runJulesOnPR } from 'julets/ci';

await runJulesOnPR({
  prompt: 'Review this PR for potential bugs and suggest improvements.',
  githubToken: process.env.GITHUB_TOKEN,
  // Automatically infers repo, PR number, etc. from the CI environment
});
```

### 12. `session.getArtifacts()` Helper

- **Category:** Helper
- **Complexity:** Medium
- **Impact:** Medium
- **Description:** A method that streams the entire session and returns a filtered list of artifacts, such as all `changeSet` or `media` objects produced during the session's lifetime. This is useful for post-session analysis.
- **API Example:**

```typescript
const { changeSets, media } = await session.getArtifacts();

console.log(`Session produced ${changeSets.length} change sets.`);

if (media.length > 0) {
  const screenshot = media.find((m) => m.mimeType === 'image/png');
  // ... save screenshot to disk
}
```

### 13. Cost Estimation / Pre-flight Check

- **Category:** DX
- **Complexity:** Low
- **Impact:** Low
- **Description:** A client-side helper that analyzes a `SessionConfig` and provides a warning or estimation before creation. For example, it could warn if a prompt is too vague or if the user forgot to specify a branch, preventing accidental long-running or misconfigured sessions. This does not require a backend change.
- **API Example:**

```typescript
import { estimateSession } from 'julets';

const { warnings } = estimateSession({
  source: { github: 'my/repo' }, // Missing branch
  prompt: 'fix it', // Vague prompt
});

// warnings => ['No branch specified, defaulting to main.', 'Prompt is very short...']
```

### 14. Integration with `execa` for Local Command Execution

- **Category:** Tooling
- **Complexity:** Medium
- **Impact:** Medium
- **Description:** Provide a helper that can safely parse `bash` commands from agent `progressUpdated` activities and execute them locally using a library like `execa`. This could include a confirmation step to prevent accidental execution.
- **API Example:**

```typescript
import { createCommandRunner } from 'julets/exec';

const runner = createCommandRunner({ askBeforeRun: true });

for await (const activity of session.stream()) {
  if (activity.type === 'progressUpdated') {
    // runner would parse the description for shell commands
    await runner.runFrom(activity);
  }
}
```

### 15. Snapshot Testing for Agent Behavior

- **Category:** Tooling
- **Complexity:** High
- **Impact:** Medium
- **Description:** A utility for integration testing. It would allow a developer to "record" a live session's activities to a fixture file. Subsequent test runs could "replay" this fixture against the SDK to ensure that client-side logic (e.g., parsing, streaming, state management) handles the known sequence of events correctly.
- **API Example:**

```typescript
// In a test file
import { testWithSnapshot } from 'julets/testing';

test('handles boba app creation session', async () => {
  await testWithSnapshot('fixtures/boba-app-session.json', async (session) => {
    // Your test logic here, using the replayed `session` object
    const result = await session.result();
    expect(result.status).toBe('completed');
    expect(result.pullRequest.url).toBeDefined();
  });
});
```

### 16. Local Session Cache
- **Category:** DX
- **Complexity:** Medium
- **Impact:** Medium
- **Description:** A mechanism to automatically cache the state of in-progress sessions to the local filesystem. This allows scripts to be re-run and automatically re-attach to the previous session if the script crashed or was interrupted, preventing the need to manually track session IDs.
- **API Example:**
```typescript
const jules = new JulesClient({
  cache: {
    enabled: true,
    // Optional: specify a directory
    // directory: './.jules/cache',
  },
});

// If a cached session for this scope exists, it will re-attach.
// The "scope" could be inferred from a title or a custom ID.
const session = await jules.run({
  title: 'My Important Refactoring Task',
  // ... other config
});

// session object is now attached to the new or existing session
console.log(`Attached to session: ${session.id}`);
```

### 17. State-Specific Timeouts
- **Category:** Helper
- **Complexity:** Medium
- **Impact:** Medium
- **Description:** A helper to automatically manage timeouts for states that require human interaction (like `awaitingPlanApproval`). If a user doesn't provide input within a configured duration, the SDK can automatically perform a default action, such as cancelling the session, preventing indefinite hangs.
- **API Example:**
```typescript
session.onStateChange('awaitingPlanApproval', {
  timeout: 10 * 60 * 1000, // 10 minutes
  onTimeout: async () => {
    console.log('No approval received, cancelling session.');
    await session.cancel();
  },
});

// The main logic can continue, and the timeout will run in the background.
await session.result();
```

### 18. Composable Prompt Builder
- **Category:** DX
- **Complexity:** Medium
- **Impact:** High
- **Description:** A builder utility for constructing complex prompts from multiple sources (file contents, git diffs, system messages, user requests). This abstracts the boilerplate of reading files and concatenating strings, and could intelligently manage context to fit within token limits.
- **API Example:**
```typescript
import { PromptBuilder } from 'julets/prompt';

// Utility would need access to filesystem (Node.js)
const prompt = await new PromptBuilder()
  .withSystemMessage('You are an expert TypeScript developer...')
  .addFileContext('src/api.ts')
  .addFileContext('src/types.ts')
  .withUserRequest('Refactor the API client to use the new types.')
  .build(); // Returns the final prompt string

const session = await jules.run({ prompt });
```

### 19. Session Dry Run
- **Category:** Tooling
- **Complexity:** Medium
- **Impact:** High
- **Description:** A client-side "dry run" mode that simulates a session creation and initial interaction without actually calling the backend API. It would validate the session configuration, check local file paths, and return a mock session object. This allows developers to test their script's setup and initial logic (e.g., prompt builders, event listeners) quickly and offline.
- **API Example:**
```typescript
const jules = new JulesClient();

// The `dryRun()` method validates config and returns a mock session
// that can be used to test local setup and logic.
const session = await jules.run(
  {
    source: { github: 'my/repo' },
    prompt: 'This is my prompt',
  },
  { dryRun: true },
);

// The mock session can have listeners attached to test eventing logic
session.on('plan', () => {
  console.log('Plan listener was correctly attached.');
});

console.log(`Dry run successful. Session ID: ${session.id}`); // e.g., 'dry-run-12345'
```

### 20. Artifact-Aware Session Result
- **Category:** Helper
- **Complexity:** Medium
- **Impact:** Medium
- **Description:** Enhance the `session.result()` method to not only return the final state but also to automatically collect and organize all artifacts generated during the session. This saves the developer from having to iterate through the stream themselves for the common use case of retrieving all outputs.
- **API Example:**
```typescript
const { finalState, artifacts } = await session.result({ collectArtifacts: true });

console.log(`Session completed with status: ${finalState.status}`);

// Artifacts are pre-filtered and organized by type.
if (artifacts.changeSets.length > 0) {
  console.log(`Found ${artifacts.changeSets.length} patch(es).`);
  // await applyPatch(artifacts.changeSets[0]);
}

if (artifacts.media.length > 0) {
  console.log(`Found ${artifacts.media.length} media file(s).`);
  // await saveMedia(artifacts.media[0]);
}
```

### 21. Human-in-the-Loop (`session.promptUser`)
- **Category:** Helper
- **Complexity:** High
- **Impact:** High
- **Description:** Provide a built-in helper method that pauses the session stream and prompts the human operator for input directly in the terminal. The developer could define a question, and the user's response would be sent back to the agent via `session.send()`. This simplifies creating interactive scripts where the agent might need clarification.
- **API Example:**
```typescript
session.on('progress', async (activity) => {
  // Check for a special marker in the agent's message
  if (activity.description.includes('NEEDS_CLARIFICATION')) {
    const response = await session.promptUser(
      'The agent needs more information. What should I tell it?',
    );
    // The user's terminal input is sent back to the agent.
    await session.send(response);
  }
});

await session.result();
```
