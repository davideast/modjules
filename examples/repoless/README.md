# Repoless Session Example

This example demonstrates creating Jules sessions **without** attaching them to a GitHub repository. These "repoless" sessions are useful for:

- General coding questions and discussions
- Code review assistance without repo context
- Learning and exploration tasks
- Concept explanations

## Prerequisites

1. Set your Jules API key:

   ```bash
   export JULES_API_KEY=your-api-key-here
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Automated Run (default)

Creates a repoless session in automated mode:

```bash
bun run main.ts
# or
bun run main.ts run
```

### Interactive Session

Creates a repoless interactive session:

```bash
bun run main.ts session
```

## How It Works

The key difference from regular sessions is simply **omitting the `source` property**:

```typescript
// Regular session (attached to a repo)
const session = await jules.session({
  prompt: 'Fix the login bug',
  source: { github: 'owner/repo', branch: 'main' },
});

// Repoless session (no repo context)
const session = await jules.session({
  prompt: 'Explain TypeScript generics',
  // Note: No 'source' property!
});
```

Both `jules.run()` and `jules.session()` support repoless mode.

## Notes

- Repoless sessions cannot create Pull Requests (since there's no repo)
- The agent won't have access to any repository context
- Useful for general programming assistance and code review
