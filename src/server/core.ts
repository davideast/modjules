import { Platform } from '../platform/types.js';
import { TokenManager } from '../auth/tokenizer.js';
import { HandshakeRequest, HandshakeResponse } from '../auth/protocol.js';
import { ServerConfig, ServerRequest } from './types.js';
import { JulesClientImpl } from '../client.js'; // Admin Client
import { ActivityStorage } from '../storage/types.js';

export function createHandlerCore(config: ServerConfig, platform: Platform) {
  const tokenizer = new TokenManager(platform, config.clientSecret);

  // The Admin Client (Server-Side Only) has full access
  const adminClient = new JulesClientImpl(
    { apiKey: config.apiKey, platform }, // Use injected platform
    () => ({}) as ActivityStorage, // Dummy storage factory as we don't use storage in generic proxy
    platform,
  );

  return async (req: ServerRequest): Promise<{ status: number; body: any }> => {
    try {
      // --- FLOW A: HANDSHAKE (Login) ---
      // The client is asking for a Capability Token
      if (req.method === 'POST' && req.body?.intent) {
        return await handleHandshake(req.body, config, adminClient, tokenizer);
      }

      // --- FLOW B: PROXY (Traffic) ---
      // The client is trying to talk to Jules
      const authHeader =
        req.headers['authorization'] || req.headers['Authorization'];
      if (!authHeader?.startsWith('Bearer ')) {
        return { status: 401, body: { error: 'Missing token' } };
      }

      const token = authHeader.split(' ')[1];
      const claims = await tokenizer.verify(token); // Throws if invalid

      // 1. Scope Validation (Authorization)
      // Ensure the URL matches the token's allowed session ID
      // e.g. path: "/sessions/123/activities" -> allowed: "123"
      const pathSegments = req.path.split('/');
      const sessionIdIndex = pathSegments.indexOf('sessions') + 1;
      const targetSessionId = pathSegments[sessionIdIndex];

      if (targetSessionId && targetSessionId !== claims.scope.sessionId) {
        return {
          status: 403,
          body: { error: 'Scope violation: Access denied to this session' },
        };
      }

      // 2. Forwarding (The Proxy)
      // We strip the Capability Token and swap in the real API Key
      const googleUrl = `https://jules.googleapis.com/v1alpha/${req.path.replace(/^\//, '')}`;

      const upstreamRes = await platform.fetch(googleUrl, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': config.apiKey, // Inject Key
        },
        body: req.body ? JSON.stringify(req.body) : undefined,
      });

      return {
        status: upstreamRes.status,
        body: await upstreamRes.json(),
      };
    } catch (error: any) {
      console.error(error);
      return { status: 500, body: { error: error.message } };
    }
  };
}

// --- Helper: Handshake Logic ---

async function handleHandshake(
  body: HandshakeRequest,
  config: ServerConfig,
  client: JulesClientImpl,
  tokenizer: TokenManager,
): Promise<{ status: number; body: HandshakeResponse }> {
  try {
    // 1. Verify User Identity (e.g. Firebase)
    const identity = await config.verify(body.authToken || '');

    // 2. Execute Intent
    let sessionId: string;

    if (body.intent === 'create') {
      // Create new session via Admin SDK
      // (Simplified: In real code, map body.context to SessionConfig)
      // Ensure body.context has prompt and source
      const session = await client.run({
        prompt: body.context.prompt,
        source: body.context.source,
      });
      sessionId = session.id;
    } else {
      // Resume existing
      // TODO: Add ownership check here in Phase 4
      sessionId = body.sessionId;
    }

    // 3. Mint Capability Token
    const token = await tokenizer.mint({ sessionId });

    return {
      status: 200,
      body: { success: true, token, sessionId },
    };
  } catch (e: any) {
    return { status: 403, body: { success: false, error: e.message } };
  }
}
