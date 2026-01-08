# Batch Processing

`jules.all()` is built for large-scale, parallel code modification. It's the tool you need when you have to apply the same change across dozens or hundreds of repositories at once.

It works like a `Promise.all()` combined with `Array.map()`, running a Jules session for each item in an array, with built-in concurrency control to manage the load.

## Example: Large-Scale API Migration

Imagine your company is deprecating an old logging library (`AcmeLogger`) and replacing it with a new one (`LogCorp`). This change needs to be applied to over 50 microservices. `jules.all()` can automate this entire migration.

**1. Create a List of Repositories**

First, create a simple text file (`repos.txt`) that lists all the repositories that need to be updated.

```
my-org/service-alpha
my-org/service-beta
my-org/service-gamma
# ... 50 more repos
```

**2. Create the Orchestration Script**

This script reads the list of repositories and uses `jules.all()` to dispatch a migration job for each one.

```typescript
// migrate.ts
import { jules } from 'modjules';
import * as fs from 'fs/promises';

// ... script to run migration from example ...
```

When you run this script (`npx tsx migrate.ts`), it will kick off multiple concurrent jobs, creating pull requests as they complete, until all repositories have been updated.

---

## Reference: Configuration and Error Handling

You can control the execution behavior by passing a configuration object as the third argument to `jules.all()`.

```typescript
const results = await jules.all(items, mapper, {
  concurrency: 10,
  stopOnError: false,
  delayMs: 500,
});
```

### Configuration Options

| Option        | Type      | Default | Description                                                                                                                      |
| :------------ | :-------- | :------ | :------------------------------------------------------------------------------------------------------------------------------- |
| `concurrency` | `number`  | `3`     | The maximum number of sessions to start concurrently.                                                                            |
| `stopOnError` | `boolean` | `true`  | If `true`, the batch operation stops immediately and rejects if any item fails. If `false`, it continues processing other items. |
| `delayMs`     | `number`  | `0`     | A delay in milliseconds to wait before starting each item. Useful for avoiding rate limits on external APIs.                     |

### Error Handling

By default (`stopOnError: true`), `jules.all()` will "fail fast". If any session fails to start, the entire operation is cancelled and the promise rejects with a single error.

If you want to ensure the entire batch is attempted, set `stopOnError: false`. In this mode, if one or more jobs fail, `jules.all()` will wait for all jobs to complete and then throw an `AggregateError`. This error object contains a list of all the individual errors that occurred, allowing you to inspect each failure.

```typescript
try {
  await jules.all(items, mapper, { stopOnError: false });
} catch (error) {
  if (error instanceof AggregateError) {
    console.error(`Batch finished with ${error.errors.length} failures.`);
    for (const individualError of error.errors) {
      console.error(`- Failure: ${individualError.message}`);
    }
  }
}
```
