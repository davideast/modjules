# Jules SDK: Rich Artifact Types

When you stream activities from a Jules session, some activities will contain `Artifact` objects. While some artifacts are simple data structures (like `changeSet`), the Jules SDK provides enhanced functionality for others, specifically `MediaArtifact` and `BashArtifact`. This guide explains how to work with these rich artifact types.

## MediaArtifact

A `MediaArtifact` represents a media file, such as a PNG image generated during frontend verification. The SDK provides a convenient helper method to save this media directly to your filesystem.

### Properties

- `type`: Always `'media'`.
- `data`: A base64-encoded string of the media file's content.
- `format`: The MIME type of the media (e.g., `'image/png'`).

### Methods

#### `save(filepath: string): Promise<void>`

This method decodes the base64 `data` and saves it as a file at the specified path.

**Note:** This method is only available in a Node.js environment. Calling it in a browser will throw an error.

### Example

Here is how you can identify a `MediaArtifact` in the activity stream and save it to a file.

```typescript
import { promises as fs } from 'fs';

for await (const activity of session.stream()) {
  for (const artifact of activity.artifacts) {
    // Check if the artifact is a media artifact
    if (artifact.type === 'media') {
      console.log(`Found a media artifact with format: ${artifact.format}`);

      // Example: Save any PNG images
      if (artifact.format === 'image/png') {
        const filepath = './screenshot.png';
        try {
          await artifact.save(filepath);
          console.log(`Successfully saved screenshot to ${filepath}`);
        } catch (error) {
          console.error(`Failed to save screenshot: ${error.message}`);
        }
      }
    }
  }
}
```

## BashArtifact

A `BashArtifact` represents the output of a shell command executed by the agent. It captures the standard output, standard error, and exit code, and provides a helper method to get a nicely formatted summary.

### Properties

- `type`: Always `'bashOutput'`.
- `command`: The command that was executed.
- `stdout`: The content written to standard output.
- `stderr`: The content written to standard error.
- `exitCode`: The exit code of the command (or `null` if it could not be determined).

### Methods

#### `toString(): string`

This method returns a formatted string that combines the command, exit code, `stdout`, and `stderr`, making it easy to log or display.

### Example

Here is how you can inspect a `BashArtifact` and print its formatted output.

```typescript
for await (const activity of session.stream()) {
  if (activity.type === 'progressUpdated') {
    for (const artifact of activity.artifacts) {
      // Check if the artifact is a bash artifact
      if (artifact.type === 'bashOutput') {
        console.log('Agent ran a bash command. Here is the summary:');

        // Use the toString() helper for a clean, readable output
        console.log(artifact.toString());

        // You can also access individual properties
        if (artifact.exitCode !== 0) {
          console.error(`Command failed with exit code ${artifact.exitCode}`);
          console.error('Stderr:', artifact.stderr);
        }
      }
    }
  }
}
```

**Sample `toString()` Output:**

```
$ npm install
Exit Code: 0

[stdout]
added 12 packages, and audited 13 packages in 1s

[stderr]
(empty)
```
