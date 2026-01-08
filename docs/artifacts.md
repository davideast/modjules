# Working with Artifacts

As an agent works, it produces artifacts: code changes, shell command outputs, test results, and even screenshots. These are attached to the `Activity` objects you get from `session.stream()`.

Here’s how you can inspect the artifacts from a session to see what the agent is doing.

## Example: Inspecting Session Artifacts

This example loops through the activity stream and checks for different types of artifacts.

```typescript
import { jules } from 'modjules';

const session = jules.session('some-session-id');

for await (const activity of session.stream()) {
  for (const artifact of activity.artifacts) {
    // Handle code changes
    if (artifact.type === 'changeSet') {
      const parsed = artifact.parsed();
      console.log(`[CODE] ${parsed.files.length} files changed.`);
      for (const file of parsed.files) {
        console.log(`  - ${file.path} (+${file.additions} -${file.deletions})`);
      }
    }

    // Handle shell command output (e.g., test results)
    if (artifact.type === 'bashOutput') {
      if (artifact.exitCode === 0) {
        console.log('[TESTS] A command ran successfully.');
      } else {
        console.error('[TESTS] A command failed!');
      }
      // Log a clean summary of the command's output
      console.log(artifact.toString());
    }

    // Handle images or other media
    if (artifact.type === 'media' && artifact.format.startsWith('image/')) {
      const filepath = `./screenshots/${activity.id}.png`;
      await artifact.save(filepath);
      console.log(`[MEDIA] Saved screenshot to ${filepath}`);
    }
  }
}
```

## Artifact Types

### Change Sets (`changeSet`)

This artifact is a Git patch. The `.parsed()` method is the easiest way to work with it. It returns a structured object with the files, additions, and deletions.

```typescript
const parsed = artifact.parsed();
// parsed.summary -> "1 file changed, 10 insertions(+), 5 deletions(-)"
// parsed.files -> [{ path: 'src/index.ts', additions: 10, deletions: 5 }]
```

### Bash Output (`bashOutput`)

This artifact contains the result of a shell command.

- Use the `.toString()` method to get a nicely formatted summary for logging.
- Check the `.exitCode` property to see if the command succeeded (`0`) or failed (non-zero).

### Media (`media`)

This artifact represents a file, like a screenshot (`image/png`).

- Use the `.save(filepath)` method to save the file to the filesystem (or IndexedDB in the browser).
- Use `.toUrl()` to get a `data:` URI for displaying the media in a browser.
