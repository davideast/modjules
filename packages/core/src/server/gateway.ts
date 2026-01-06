import { Platform } from '../platform/types.js';
import { TokenManager } from '../auth/tokenizer.js';
import { HandshakeRequest, HandshakeResponse } from '../auth/protocol.js';
import {
  ServerRequest,
  ServerResponse,
  SessionGatewayConfig,
  Scope,
} from './types.js';
import { JulesClientImpl } from '../client.js';
import { MemoryStorage } from '../storage/memory.js';
import { Identity } from '../auth/types.js';

// --- 1. The Forwarder (Dumb Proxy) ---

/**
 * Forwards requests to the Jules API without authentication.
 * Responsible ONLY for URL rewriting, API Key injection, and Fetching.
 */
export async function proxyRequest(
  apiKey: string,
  platform: Platform,
  req: ServerRequest,
): Promise<ServerResponse> {
  try {
    // Extract path from URL (supports full URL or just path)
    const urlObj = new URL(req.url, 'http://localhost');
    const path = urlObj.pathname.replace(/^\/+/, '');

    // Construct Upstream URL
    const julesApiUrl = `https://jules.googleapis.com/v1alpha/${path}${urlObj.search}`;

    const upstreamRes = await platform.fetch(julesApiUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: req.body ? JSON.stringify(req.body) : undefined,
    });

    const text = await upstreamRes.text();
    const body = text ? JSON.parse(text) : {};

    return {
      status: upstreamRes.status,
      body,
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

/**
 * Verifies session access based on the capability token.
 * Checks token validity, session scope, and RBAC permissions.
 */
export async function verifyAccess(
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
    const urlObj = new URL(req.url, 'http://localhost');
    const pathSegments = urlObj.pathname.split('/');
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
    const scopes = (claims.scope as any).scopes || [];

    const isWrite = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
    const hasWriteScope = scopes.includes('write') || scopes.includes('admin');
    const hasReadScope = scopes.includes('read') || scopes.includes('admin');

    if (isWrite && !hasWriteScope) {
      return {
        allowed: false,
        status: 403,
        error: 'Read-only token: Write access required',
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

// --- 3. The Handshake ---

/**
 * Handles the handshake flow for session creation or resumption.
 * Returns a capability token scoped to the session.
 */
export async function handleHandshake(
  body: HandshakeRequest,
  config: SessionGatewayConfig,
  client: JulesClientImpl,
  tokenizer: TokenManager,
  platform: Platform,
): Promise<ServerResponse> {
  try {
    // 1. Verify Identity
    const identityOrUid = await config.auth.verify(
      body.authToken || '',
      platform,
    );
    const identity: Identity =
      typeof identityOrUid === 'string'
        ? { uid: identityOrUid }
        : identityOrUid;

    // 2. Execute Intent
    let sessionId: string;
    let scopes: Scope[] = ['read'];

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
      const result = await config.auth.authorize(identity, sessionId);
      scopes = result.scopes || ['read', 'write'];
    }

    // 3. Mint Capability Token
    const token = await tokenizer.mint({ sessionId, scopes } as any);

    return {
      status: 200,
      body: { success: true, token, sessionId } as HandshakeResponse,
    };
  } catch (e: any) {
    console.error('Handshake Error:', e);
    return {
      status: 403,
      body: { success: false, error: e.message } as HandshakeResponse,
    };
  }
}
