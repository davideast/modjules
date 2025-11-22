# Batch Processing with `jules.all()`

The `jules.all()` method allows you to process a batch of data items by mapping them to session configurations and executing them concurrently. It is designed to be a familiar, "JavaScript-native" experience, similar to `Promise.all()` or `Array.map()`.

## Why `jules.all`?

When building automation workflows, you often start with a list of items—GitHub issues, database rows, or TODO comments—that you want to process with Jules.

Instead of manually managing a loop, concurrency limits, and result mapping, `jules.all` handles the orchestration for you.

### Key Features

1.  **Order Preservation**: The returned array of results matches the order of the input array, regardless of which session finishes first.
2.  **Concurrency Control**: Limits the number of parallel sessions to avoid hitting rate limits.
3.  **Promise Semantics**: Returns a standard Promise, compatible with `await`, `Promise.all`, and `Promise.allSettled`.

## Basic Usage

The simplest usage takes an array of data and a mapper function.

```javascript
import { jules } from 'modjules';

const issues = [
  { id: 1, title: 'Fix login page' },
  { id: 2, title: 'Update documentation' },
  { id: 3, title: 'Optimize database queries' },
];

const sessions = await jules.all(issues, (issue) => ({
  prompt: `Fix issue #${issue.id}: ${issue.title}`,
  source: { github: 'my-org/my-repo', branch: 'main' },
}));

console.log(`Started ${sessions.length} sessions.`);
```

## Advanced Configuration

You can control the execution behavior with the optional third argument.

```javascript
const sessions = await jules.all(items, mapper, {
  concurrency: 10, // Default is 4
  stopOnError: false, // Default is true
  delayMs: 1000, // Default is 0
});
```

### Options

| Option        | Type      | Default | Description                                                                                                          |
| :------------ | :-------- | :------ | :------------------------------------------------------------------------------------------------------------------- |
| `concurrency` | `number`  | `4`     | The maximum number of sessions to start concurrently.                                                                |
| `stopOnError` | `boolean` | `true`  | If `true`, the batch operation stops immediately if any item fails. If `false`, it continues processing other items. |
| `delayMs`     | `number`  | `0`     | A delay in milliseconds to wait before starting each item. Useful for rate limiting.                                 |

## Error Handling

### Fail Fast (Default)

By default (`stopOnError: true`), if any session fails to start (e.g., due to an API error or invalid config), the entire `jules.all()` promise rejects immediately.

```javascript
try {
  await jules.all(items, mapper);
} catch (error) {
  console.error('Batch processing failed:', error);
}
```

### Best Effort

If you want to process as many items as possible, set `stopOnError: false`. If errors occur, `jules.all()` will wait for all items to finish and then throw an `AggregateError` containing all the errors encountered.

```javascript
try {
  await jules.all(items, mapper, { stopOnError: false });
} catch (error) {
  if (error instanceof AggregateError) {
    console.log(`Finished with ${error.errors.length} errors.`);
    // You might want to inspect successful results, but jules.all returns strict array.
    // In this mode, it is recommended to handle errors INSIDE your mapper if you need partial results.
  }
}
```
