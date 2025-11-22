# Browser Usage

The `modjules/browser` module is optimized for use in browser environments, providing the same powerful features as the Node.js version but tailored for the client-side. It leverages `IndexedDB` for local caching, enabling fast, offline-capable agentic applications.

> **Warning:** Never expose your `JULES_API_KEY` in a production or public-facing application. The browser module is designed for trusted client environments like Electron apps or websites running exclusively on a local machine where the key is not accessible to unauthorized users.

## Installation and Bundling

Most modern bundlers like Vite, Turbopack, or Webpack will automatically resolve the correct module (`modjules` or `modjules/browser`) based on the environment. However, you can also import it explicitly.

### Explicit Import

To ensure you are using the browser-specific build, you can import it directly:

```typescript
import { jules } from 'modjules/browser';

const session = jules.run({
  prompt: 'Generate a new logo for our brand.',
});

console.log('Session started:', session.id);
```

This is useful if your tooling doesn't support conditional exports or if you want to be explicit in your code.

## Aborting Requests

The browser module integrates with the standard `AbortController` API, allowing you to cancel in-flight requests. This is particularly useful for managing user interactions, like when a user navigates away from a page or cancels an operation.

All methods that initiate a network request accept an `options` object with an `AbortSignal`.

```typescript
import { jules } from 'modjules/browser';

const controller = new AbortController();
const { signal } = controller;

async function run() {
  try {
    const session = await jules.run(
      { prompt: 'Tell me a very long story.' },
      { signal }, // Pass the signal here
    );

    // To cancel the request
    // controller.abort();

    for await (const activity of session.stream({ signal })) {
      console.log(activity.type);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Request was aborted.');
    } else {
      console.error('An error occurred:', error);
    }
  }
}

run();
```

## Working with Artifacts

Artifacts like images, logs, or code changes can be directly manipulated and displayed in the browser.

### Displaying Images

The `artifact.toUrl()` method is especially useful in the browser. It returns a `data:` URL, which can be assigned directly to the `src` attribute of an `<img>` tag to render an image without needing to save it first.

```typescript
import { jules } from 'modjules/browser';

const session = jules.session('your-session-id');
const imageContainer = document.getElementById('image-container');

for await (const activity of session.stream()) {
  for (const artifact of activity.artifacts) {
    if (artifact.type === 'media' && artifact.format.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = artifact.toUrl();
      imageContainer.appendChild(img);
    }
  }
}
```

## Caching and Storage

The browser module uses `IndexedDB` to provide a persistent, local-first cache for session activities. This makes your application more resilient to network issues and allows for a snappy, offline-first user experience.

### How it Works

- **Database:** A database named `jules-cache` is created in your browser's `IndexedDB`.
- **Stores:** Each session's activities are stored in a dedicated object store, keyed by the session ID.

### Saving Artifacts

The `artifact.save()` method in the browser module behaves differently than in Node.js. Instead of writing to the filesystem, it saves the artifact's data to `IndexedDB`.

This is useful for storing large artifacts like images or generated files locally without requiring the user to download them immediately.

```typescript
// (Inside a stream loop)
for (const artifact of activity.artifacts) {
  if (artifact.type === 'media') {
    // Saves the artifact's data to IndexedDB
    await artifact.save();
    console.log(`Artifact ${artifact.id} saved locally.`);
  }
}
```

You can then retrieve this data later from `IndexedDB` as needed, even across page reloads.
