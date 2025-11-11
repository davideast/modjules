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

This method decodes the base64 `data` and saves it.

- **Node.js:** Saves the artifact as a file at the specified `filepath` on the local filesystem.
- **Browser:** Saves the artifact to the `artifacts` object store in IndexedDB, using `filepath` as the key. This acts as a virtual filesystem within the browser's sandbox.

#### `toUrl(): string`

Returns a URL string that can be used to display or download the media.

- **Browser:** Returns a `data:` URI.
- **Node.js:** Returns a `data:` URI.

### Example

Here is how you can work with `MediaArtifact` in both Node.js and browser environments.

```typescript
for await (const activity of session.stream()) {
  for (const artifact of activity.artifacts) {
    if (artifact.type === 'media' && artifact.format === 'image/png') {
      // 1. Save the artifact (works in both Node.js and Browser)
      // Node.js: writes to ./screenshots/image.png
      // Browser: writes to IndexedDB with key './screenshots/image.png'
      await artifact.save('./screenshots/image.png');

      // 2. Get a displayable URL (works in both Node.js and Browser)
      const url = artifact.toUrl();
      console.log('Image URL:', url);
      // Browser: can be used in <img src={url} />
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
