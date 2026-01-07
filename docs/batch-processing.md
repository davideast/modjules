# Batch Processing

Got a list of 50 bugs to fix, 100 files to refactor, or a spreadsheet of prompts to run? `jules.all()` is the tool for running the same task across a large list of items.

It works like a `Promise.all()` combined with `Array.map()`, running a Jules session for each item in an array, with built-in concurrency control.

## Example: Fixing a List of Bugs

Imagine you have a list of tracked bugs you want Jules to fix. `jules.all()` can create a session for each one.

```javascript
import { jules } from 'modjules';

const bugs = [
  { id: 123, title: 'Login button unresponsive on mobile' },
  { id: 124, title: 'User profile pictures are not loading' },
  { id: 125, title: 'API returns 500 error on password reset' },
];

async function fixAllBugs() {
  console.log(`Starting a batch job to fix ${bugs.length} bugs.`);

  // jules.all takes the array and a "mapper" function
  // that returns a session configuration for each item.
  const results = await jules.all(bugs, (bug) => ({
    prompt: `Fix issue #${bug.id}: ${bug.title}`,
    source: { github: 'my-org/my-repo', branch: 'main' },
    autoPr: true,
  }));

  console.log('Batch job complete.');
  results.forEach((result, index) => {
    if (result.pullRequest) {
      console.log(`- Bug #${bugs[index].id}: ${result.pullRequest.url}`);
    } else {
      console.log(`- Bug #${bugs[index].id}: Failed to generate a PR.`);
    }
  });
}

fixAllBugs();
```

## Why Use `jules.all()`?

Instead of writing a manual `for` loop, `jules.all()` handles the tricky parts of batch processing for you:

-   **Concurrency:** It runs jobs in parallel but limits how many are active at once to avoid rate limiting.
-   **Order:** The final array of results is in the same order as your input array, even if the jobs finish out of order.
-   **Simplicity:** It returns a single promise that resolves when all the work is done.

## Configuration

You can control how the batch is executed by passing a configuration object as the third argument.

```javascript
const results = await jules.all(items, mapper, {
  concurrency: 10, // Run up to 10 sessions at once (default is 3)
  stopOnError: false, // If one session fails, continue with the rest (default is true)
  delayMs: 500, // Wait 500ms before starting each session
});
```
