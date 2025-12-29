import {
  GatewayConfig,
  ProxyGatewayConfig,
  SessionGatewayConfig,
  ServerRequest,
  ServerResponse,
} from './types.js';
import { WebPlatform } from '../platform/web.js';
import { JulesClientImpl } from '../client.js';
import { TokenManager } from '../auth/tokenizer.js';
import { MemoryStorage, MemorySessionStorage } from '../storage/memory.js';
import { proxyRequest, verifyAccess, handleHandshake } from './gateway.js';
import { Platform } from '../platform/types.js';

/**
 * Creates a Jules Gateway to handle traffic to the Jules API.
 *
 * Supports two modes:
 * 1. **Proxy** (`kind: 'proxy'`): Simple pass-through to Jules API. No auth checks.
 * 2. **Session** (`kind: 'session'`): Managed access with Handshake and RBAC enforcement.
 *
 * @example
 * ```typescript
 * // Simple Proxy (server-to-server, trusted environments)
 * const handler = createGateway({
 *   kind: 'proxy',
 *   apiKey: process.env.GOOGLE_API_KEY!,
 * });
 *
 * // Session Gateway (public-facing apps)
 * const handler = createGateway({
 *   kind: 'session',
 *   apiKey: process.env.GOOGLE_API_KEY!,
 *   clientSecret: process.env.CLIENT_SECRET!,
 *   auth: {
 *     verify: async (token) => { ... },
 *     authorize: async (user, sessionId) => ({ scopes: ['read', 'write'] }),
 *   },
 * });
 *
 * // Use as a route handler (Next.js, Hono, Remix, etc.)
 * export const POST = handler;
 * ```
 */
export function createGateway(config: GatewayConfig) {
  // 1. Resolve Platform (Web-first default)
  const platform: Platform = config.platform || new WebPlatform();

  // 2. Setup Dependencies for Session Mode
  let tokenizer: TokenManager | undefined;
  let adminClient: JulesClientImpl | undefined;

  if (config.kind === 'session') {
    tokenizer = new TokenManager(platform, config.clientSecret);
    // Admin client for 'create' operations
    adminClient = new JulesClientImpl(
      { apiKey: config.apiKey, platform },
      {
        activity: () => new MemoryStorage(),
        session: () => new MemorySessionStorage(),
      },
      platform,
    );
  }

  // 3. Return the Standard Web Handler
  return async (req: Request): Promise<Response> => {
    // Adapter: Web Request -> ServerRequest
    let body: any = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        body = await req.json();
      } catch {
        // Body might be empty or not JSON
      }
    }

    // Normalize headers
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Extract path for routing
    const url = new URL(req.url);
    const path = url.searchParams.get('path') || url.pathname;

    const serverReq: ServerRequest = {
      method: req.method,
      url: path + url.search,
      headers,
      body,
    };

    let result: ServerResponse;

    // --- LOGIC BRANCHING ---

    if (config.kind === 'session' && adminClient && tokenizer) {
      // A. Handshake Detection (explicit path or intent in body)
      const isHandshake =
        url.pathname.endsWith('/handshake') ||
        url.searchParams.get('action') === 'handshake' ||
        (req.method === 'POST' && body?.intent);

      if (isHandshake && req.method === 'POST' && body?.intent) {
        result = await handleHandshake(
          body,
          config,
          adminClient,
          tokenizer,
          platform,
        );
      }
      // B. Secure Proxy (Session Mode)
      else {
        const access = await verifyAccess(serverReq, tokenizer);
        if (!access.allowed) {
          result = {
            status: access.status || 403,
            body: { error: access.error },
          };
        } else {
          result = await proxyRequest(config.apiKey, platform, serverReq);
        }
      }
    }
    // C. Simple Proxy (Proxy Mode)
    else {
      result = await proxyRequest(config.apiKey, platform, serverReq);
    }

    // Adapter: ServerResponse -> Web Response
    return Response.json(result.body, {
      status: result.status,
      headers: {
        'Cache-Control': 'no-store',
        ...result.headers,
      },
    });
  };
}

// Re-export types for convenience
export type {
  GatewayConfig,
  ProxyGatewayConfig,
  SessionGatewayConfig,
  ServerRequest,
  ServerResponse,
  Scope,
  AuthorizationResult,
  AuthorizationStrategy,
  VerifyCallback,
  Identity,
} from './types.js';
