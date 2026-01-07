# Getting Started

This guide will get you from zero to your first running `modjules` session.

## Installation

First, install the SDK and set your API key.

```bash
npm install modjules
export JULES_API_KEY=<your-api-key>
```

## Your First Session

Create a file named `index.ts` and add the following code. This example starts a new session to refactor some code in a GitHub repository and streams the progress to your console.

```typescript
// index.ts
import { jules } from 'modjules';

const session = await jules.session({
  prompt: 'Refactor the main entry point to be more modular.',
  source: { github: 'your-org/your-repo', branch: 'main' },
});

console.log(`[START] Session ${session.id} started.`);

for await (const activity of session.stream()) {
  if (activity.type === 'progressUpdated') {
    console.log(`[BUSY] ${activity.title}`);
  }
}

const result = await session.result();
console.log(`[DONE] Session finished with state: ${result.state}`);
```

Run it from your terminal: `npx tsx index.ts`.

## Discovering Available Codebases

Before an automated system can start a task, it often needs to know what codebases (or "Sources") it can work on. `jules.sources()` lets you list all repositories connected to your API key.

```typescript
// find-sources.ts
import { jules } from 'modjules';

console.log('Available GitHub Repositories:');

for await (const source of jules.sources()) {
  if (source.type === 'githubRepo') {
    const { owner, repo } = source.githubRepo;
    console.log(`- ${owner}/${repo}`);
  }
}
```

You can also fetch a specific source if you know its name.

```typescript
const myRepo = await jules.sources.get({ github: 'your-org/your-repo' });
```

This is a critical first step for any orchestration script. You can use it to find a target repository before creating a session to work on it.

## Two Ways to Use modjules

Now that you've seen the basics, it's important to understand the two main ways to create sessions, which are designed for different use cases.

### Automated Runs (`jules.run`)

Use this for "fire-and-forget" tasks where you don't need to provide feedback. It's perfect for CI scripts and automated workflows.

```typescript
const result = await jules.run({
  prompt: 'Update all dependencies to their latest versions.',
  source: { github: 'your-org/your-repo', branch: 'develop' },
  autoPr: true,
});
```

**[Dive deeper into Automated Runs &raquo;](./automated-runs.md)**

### Interactive Sessions (`jules.session`)

Use this when you want to observe, guide, or interact with the agent. It returns a `SessionClient` for building conversational, human-in-the-loop applications.

```typescript
const session = await jules.session({
  prompt: 'First, show me a plan for the refactor.',
  source: { github: 'your-org/your-repo', branch: 'feature-branch' },
});

await session.waitFor('awaitingPlanApproval');
await session.approve();
```

**[Dive deeper into Interactive Sessions &raquo;](./interactive-sessions.md)**
