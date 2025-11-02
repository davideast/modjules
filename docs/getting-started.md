# Getting Started

## Installation

```bash
npm install julets
# OR
bun add julets
```

## Initialization

The library provides a default `JulesClient` that initializes with the `process.env.JULES_API_KEY` environment variable. If you need to use multiple keys you can customize the client through the `.with()` method.

```typescript
import { jules } from 'julets';

console.log(jules); // default client automatically initializes with `process.env.JULES_API_KEY`
const custom = jules.with({ apiKey: '<other-api-key>' }); // create a custom client
```

## Core Concepts: Two Ways to Use Jules

The Jules SDK is designed to support two primary modes of operation:

1.  **Automated Mode (`jules.run()`):** Ideal for "fire-and-forget" tasks. You provide a prompt and context, and Jules works autonomously to complete the task and deliver a final result. This is perfect for CI/CD pipelines or other automated workflows.
    - **Learn more:** [Automated Runs Guide](./automated-runs.md)

2.  **Interactive Mode (`jules.session()`):** Designed for conversational workflows where you need to guide, approve, or interact with the agent. This mode gives you a `SessionClient` that you can use to have a back-and-forth conversation, approve plans, and stream real-time updates.
    - **Learn more:** [Interactive Sessions Guide](./interactive-sessions.md)

## Finding Your Sources

Before you can start a session or a run, you need to know which source repositories are available to you. The `jules.sources` manager makes this easy.

You can list all your connected sources like this:

```typescript
async function listSources() {
  for await (const source of jules.sources()) {
    if (source.type === 'githubRepo') {
      console.log(
        `Found GitHub repo: ${source.githubRepo.owner}/${source.githubRepo.repo}`,
      );
    }
  }
}

listSources();
```

Or, you can find a specific source by its GitHub identifier:

```typescript
async function findSpecificSource() {
  const sourceIdentifier = 'your-org/your-repo';
  const myRepo = await jules.sources.get({ github: sourceIdentifier });

  if (myRepo) {
    console.log(`Successfully found source: ${myRepo.name}`);
  } else {
    console.log(`Could not find source for ${sourceIdentifier}`);
  }
}

findSpecificSource();
```

With a source in hand, you are now ready to start either an automated run or an interactive session.
