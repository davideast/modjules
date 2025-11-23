import { NodePlatform } from '../platform/node.js';
import { createHandlerCore } from '../server/core.js';
import { ServerConfig } from '../server/types.js';

/**
 * Creates a generic Request/Response handler for Node.js and Edge runtimes.
 * Compatible with Next.js (App Router), Hono, Remix, and Cloudflare Workers.
 *
 * @param config - Configuration with API keys and verification logic.
 * @returns A function that takes a standard Web Request and returns a Response.
 *
 * @example
 * // Next.js Route Handler (app/api/jules/route.ts)
 * const handler = createNodeHandler({ ... });
 * export const POST = handler;
 */
export function createNodeHandler(config: ServerConfig) {
  const platform = new NodePlatform();
  // Reuse the shared "Brain" from the server core
  const coreHandler = createHandlerCore(config, platform);

  return async (req: Request): Promise<Response> => {
    // 1. Adapt Request -> PlatformRequest
    // We need to safely parse the body, as it might be empty or invalid JSON
    let body: any = undefined;
    if (req.method === 'POST' || req.method === 'PUT') {
      try {
        body = await req.json();
      } catch {
        // Body might be empty or not JSON, ignore
      }
    }

    // Extract query params for routing (e.g. ?path=/sessions/123)
    const url = new URL(req.url);
    const path = url.searchParams.get('path') || '';

    // Normalize headers
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // 2. Execute Core Logic
    const result = await coreHandler({
      method: req.method,
      path,
      headers,
      body,
    });

    // 3. Adapt PlatformResponse -> Response
    return Response.json(result.body, {
      status: result.status,
      headers: {
        // Ensure we don't cache dynamic API responses
        'Cache-Control': 'no-store',
      },
    });
  };
}
