import type { Platform } from 'modjules';
import { JulesClientImpl, MemoryStorage, MemorySessionStorage } from 'modjules';
import { TokenManager } from '../auth/tokenizer.js';
import {
  HandshakeRequest,
  HandshakeResponse,
  TokenScope,
} from '../auth/protocol.js';
import { ServerConfig, ServerRequest, Scope } from './types.js';
import { Identity } from '../auth/types.js';

// --- 1. The Forwarder (Dumb Proxy) ---
// Responsible ONLY for URL rewriting, API Key injection, and Fetching.
// No auth checks here. This allows the Simple Handler to be truly flexible.
export async function proxyRequest(
  config: ServerConfig,
  platform: Platform,
  req: ServerRequest,
): Promise<{ status: number; body: any }> {
  try {
    // Strip leading slash to prevent double slashes
    const requestPath = req.url || req.path || '';
    const normalizedPath = requestPath.replace(/^\//, '');
    const julesApiUrl = `https://jules.googleapis.com/v1alpha/${normalizedPath}`;

    const upstreamRes = await platform.fetch(julesApiUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': config.apiKey,
      },
      body: req.body ? JSON.stringify(req.body) : undefined,
    });

    // Handle 204 No Content or empty bodies gracefully
    const responseBody = await upstreamRes.text();
    const parsedBody = responseBody ? JSON.parse(responseBody) : {};

    return {
      status: upstreamRes.status,
      body: parsedBody,
    };
  } catch (error: any) {
    console.error('Upstream Proxy Error:', error);
    return {
      status: 500,
      body: { error: error.message || 'Internal Proxy Error' },
    };
  }
}

// --- 2. The Guard (Security Middleware) ---
// Responsible for Token Verification, Scope Matching, and RBAC.
async function verifySessionAccess(
  req: ServerRequest,
  tokenizer: TokenManager,
): Promise<{ allowed: boolean; error?: string; status?: number }> {
  const authHeader =
    req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      allowed: false,
      status: 401,
      error: 'Missing or invalid Authorization header',
    };
  }

  const token = authHeader.split(' ')[1];

  try {
    const claims = await tokenizer.verify(token);

    // A. Scope Validation (Session Isolation)
    // Extract session ID from URL: /sessions/<id>/...
    const requestPath = req.url || req.path || '';
    const pathSegments = requestPath.split('/');
    const sessionIdIndex = pathSegments.indexOf('sessions') + 1;
    const targetSessionId = pathSegments[sessionIdIndex];

    // If the URL targets a specific session, ensure the token matches
    if (targetSessionId && targetSessionId !== claims.scope.sessionId) {
      return {
        allowed: false,
        status: 403,
        error: 'Scope violation: Access denied to this session',
      };
    }

    // B. Permission Check (RBAC)
    const method = req.method.toUpperCase();
    const scopes = (claims.scope as any).scopes || []; // Cast to allow your new scopes property

    const isWrite = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
    const hasWriteScope = scopes.includes('write') || scopes.includes('admin');
    const hasReadScope = scopes.includes('read') || scopes.includes('admin');

    if (isWrite && !hasWriteScope) {
      return {
        allowed: false,
        status: 403,
        error: 'Permission Denied: Write access required',
      };
    }

    if (!isWrite && !hasReadScope) {
      return {
        allowed: false,
        status: 403,
        error: 'Permission Denied: Read access required',
      };
    }

    return { allowed: true };
  } catch (e) {
    return { allowed: false, status: 403, error: 'Invalid token' };
  }
}

// --- 3. The Factories ---

/**
 * Creates a "Simple" Proxy Handler.
 * Useful for trusted environments or when Auth is handled by an external gateway.
 * IT DOES NOT CHECK PERMISSIONS.
 */
export function createForwardingHandler(
  config: ServerConfig,
  platform: Platform,
) {
  return async (req: ServerRequest): Promise<{ status: number; body: any }> => {
    return await proxyRequest(config, platform, req);
  };
}

/**
 * Creates a "Secure" Proxy Handler.
 * Supports the Handshake (login) flow and enforces capability tokens.
 */
export function createHandlerCore(config: ServerConfig, platform: Platform) {
  const tokenizer = new TokenManager(platform, config.clientSecret);

  // Admin Client used for the Handshake 'create' flow
  const adminClient = new JulesClientImpl(
    { apiKey: config.apiKey, platform },
    {
      activity: () => new MemoryStorage(), // Admin client doesn't need persistence for this
      session: () => new MemorySessionStorage(),
    },
    platform,
  );

  return async (req: ServerRequest): Promise<{ status: number; body: any }> => {
    // Flow A: Handshake
    if (req.method === 'POST' && req.body?.intent) {
      return await handleHandshake(
        req.body,
        config,
        adminClient,
        tokenizer,
        platform,
      );
    }

    // Flow B: Secure Proxy
    const access = await verifySessionAccess(req, tokenizer);
    if (!access.allowed) {
      return { status: access.status || 403, body: { error: access.error } };
    }

    return await proxyRequest(config, platform, req);
  };
}

// --- Helper: Handshake Logic ---

async function handleHandshake(
  body: HandshakeRequest,
  config: ServerConfig,
  client: JulesClientImpl,
  tokenizer: TokenManager,
  platform: Platform,
): Promise<{ status: number; body: HandshakeResponse }> {
  try {
    // 1. Verify Identity
    const identityOrUid = await config.verify(body.authToken || '', platform);
    const identity: Identity =
      typeof identityOrUid === 'string'
        ? { uid: identityOrUid }
        : identityOrUid;

    // 2. Execute Intent
    let sessionId: string;
    let scopes: Scope[] = ['read']; // Default to read-only

    if (body.intent === 'create') {
      const session = await client.run({
        ...(body.context as any),
        ownerId: identity.uid,
      });
      sessionId = session.id;
      scopes = ['read', 'write', 'admin']; // Creator gets everything
    } else {
      sessionId = body.sessionId;
      // Authorize logic determines scopes
      const result = await config.authorize(identity, sessionId);
      scopes = result.scopes || ['read', 'write']; // Fallback if result doesn't explicitly return scopes
    }

    // 3. Mint Capability Token
    // We extend the TokenScope interface dynamically here or you should update protocol.ts
    const token = await tokenizer.mint({ sessionId, scopes } as any);

    return {
      status: 200,
      body: { success: true, token, sessionId },
    };
  } catch (e: any) {
    console.error('Handshake Error:', e);
    return { status: 403, body: { success: false, error: e.message } };
  }
}
