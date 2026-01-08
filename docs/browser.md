# Browser Usage

You can use `modjules` directly in the browser for prototyping and testing. It uses `IndexedDB` for local caching, giving you the same powerful local-first features as the Node.js SDK.

> **Warning: For Testing Only**
> Never expose your `JULES_API_KEY` in a public-facing or production application. For production browser applications, you must use a secure [proxy server](./PROXY.md).

## Example: Displaying a Generated Image

This example starts a session to generate an image and then displays that image on a web page.

Save this as an HTML file and open it in your browser.

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Jules Browser Demo</title>
  </head>
  <body>
    <h1>Jules Image Generator</h1>
    <div id="image-container"></div>
    <script type="module">
      import { jules } from 'https://cdn.jsdelivr.net/npm/modjules/dist/browser.mjs';

      // This is a special key for browser-based testing ONLY.
      // Do NOT use a real API key here.
      const testJules = jules.with({
        apiKey_TEST_ONLY_DO_NOT_USE_IN_PRODUCTION: '<your-api-key>',
      });

      async function generateImage() {
        const session = await testJules.session({
          prompt: 'Generate an image of a cat programming on a laptop.',
        });

        const imageContainer = document.getElementById('image-container');
        imageContainer.innerHTML = '<p>Generating image...</p>';

        for await (const activity of session.stream()) {
          for (const artifact of activity.artifacts) {
            if (
              artifact.type === 'media' &&
              artifact.format.startsWith('image/')
            ) {
              const img = document.createElement('img');
              img.src = artifact.toUrl(); // Create a data URL for the image
              imageContainer.innerHTML = ''; // Clear the "Generating..." message
              imageContainer.appendChild(img);
              return; // Stop after the first image
            }
          }
        }
      }

      generateImage();
    </script>
  </body>
</html>
```

## How It Works

The `modjules/browser` entry point is a version of the SDK compiled for browser environments.

- **Import:** You can import it from a CDN like JSDelivr or bundle it with your application using tools like Vite or Webpack.
- **Local Cache:** It uses `IndexedDB` to store session and activity data, so `jules.select()` and `session.history()` are just as fast as they are in Node.js.
- **Artifacts:** The `artifact.toUrl()` method is especially useful in the browser, as it provides a `data:` URL that can be used to display media directly. `artifact.save()` will save the artifact's data into `IndexedDB`.

## Cancelling Requests

You can use a standard `AbortController` to cancel long-running requests, which is useful for creating a responsive UI.

```typescript
const controller = new AbortController();

// To cancel:
// controller.abort();

const session = await jules.session(
  { prompt: 'Tell me a long story.' },
  { signal: controller.signal }, // Pass the signal here
);
```
